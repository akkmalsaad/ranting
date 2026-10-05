-- Parent registration links (one active link per branch) and public submission into the
-- existing pending-application workflow (20260930120000_student_applications.sql, which must be
-- applied first).
--
-- Additive: a new table, one nullable column on student_applications, and functions. No data is
-- changed. A public submission only ever creates a *pending* application for the link's branch;
-- students are still created solely by approve_student_application.
--
-- Access:
--   * registration_links: owners can read (RLS); no write grants. Links are created, reused and
--     replaced through owner-checked functions.
--   * Public (anon) callers can only: look up a link's public info (club/branch/discipline names)
--     and submit an application through submit_student_application. They cannot read or change
--     applications, set status/review fields, or choose the branch.
--
-- Abuse protection: 256-bit random tokens; per-link rate limit (20 per hour); per-club cap on
-- pending applications (500); submission ids make retries idempotent; the app adds a honeypot.
--
-- Rollback (local/test only): drop the four functions below;
--   alter table public.student_applications drop column registration_link_id;
--   drop table public.registration_links;

create table public.registration_links (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs (id) on delete restrict,
  branch_id uuid not null,
  token text not null unique check (token ~ '^[0-9a-f]{64}$'),
  created_by uuid default auth.uid() references auth.users (id) on delete restrict,
  created_at timestamptz not null default now(),
  disabled_at timestamptz,
  expires_at timestamptz, -- optional lifecycle limit; null = no expiry
  foreign key (club_id, branch_id) references public.branches (club_id, id) on delete restrict
);

-- At most one active (not disabled) link per branch; reusing it avoids a new link per share.
create unique index registration_links_one_active_per_branch on public.registration_links (branch_id) where disabled_at is null;
create index registration_links_club_idx on public.registration_links (club_id, branch_id);
create index registration_links_created_by_idx on public.registration_links (created_by);

alter table public.registration_links enable row level security;
revoke all on public.registration_links from public, anon, authenticated;
grant select on public.registration_links to authenticated;
create policy registration_links_owner_read on public.registration_links for select to authenticated
  using (private.is_club_member(club_id, '{owner}'));

alter table public.student_applications
  add column registration_link_id uuid references public.registration_links (id) on delete restrict;
create index student_applications_link_idx on public.student_applications (registration_link_id, submitted_at);

-- ---------------------------------------------------------------------------
-- Owner: get the branch's active link, creating it only if none exists.
-- ---------------------------------------------------------------------------

create function public.get_or_create_registration_link(p_club_id uuid, p_branch_id uuid)
returns text language plpgsql security definer set search_path = '' as $$
declare
  v_token text;
begin
  if not private.is_club_member(p_club_id, '{owner}') then
    raise exception 'Not authorized' using errcode = '42501';
  end if;
  perform 1 from public.branches where id = p_branch_id and club_id = p_club_id and archived_at is null;
  if not found then
    raise exception 'Choose a current branch of this club' using errcode = '23514';
  end if;
  -- An expired active link is retired so a fresh one can be issued.
  update public.registration_links set disabled_at = now()
  where branch_id = p_branch_id and disabled_at is null and expires_at is not null and expires_at <= now();
  select token into v_token from public.registration_links where branch_id = p_branch_id and disabled_at is null;
  if v_token is not null then
    return v_token;
  end if;
  insert into public.registration_links (club_id, branch_id, token, created_by)
  values (p_club_id, p_branch_id, replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''), auth.uid())
  on conflict (branch_id) where disabled_at is null do nothing
  returning token into v_token;
  if v_token is null then -- a concurrent request created it first
    select token into v_token from public.registration_links where branch_id = p_branch_id and disabled_at is null;
  end if;
  return v_token;
end;
$$;
revoke all on function public.get_or_create_registration_link(uuid, uuid) from public, anon;
grant execute on function public.get_or_create_registration_link(uuid, uuid) to authenticated;

-- Owner: stop the current link (it will show as no longer active) and issue a new one.
create function public.replace_registration_link(p_club_id uuid, p_branch_id uuid)
returns text language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_club_member(p_club_id, '{owner}') then
    raise exception 'Not authorized' using errcode = '42501';
  end if;
  update public.registration_links set disabled_at = now()
  where club_id = p_club_id and branch_id = p_branch_id and disabled_at is null;
  return public.get_or_create_registration_link(p_club_id, p_branch_id);
end;
$$;
revoke all on function public.replace_registration_link(uuid, uuid) from public, anon;
grant execute on function public.replace_registration_link(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Public: what a registration link points to. Names are returned only for an active link.
-- state: 'active' | 'invalid' | 'disabled' | 'expired' | 'branch_archived'
-- ---------------------------------------------------------------------------

create function public.get_registration_link_info(p_token text)
returns table (state text, club_name text, discipline text, branch_name text)
language plpgsql stable security definer set search_path = '' as $$
declare
  link record;
begin
  select l.disabled_at, l.expires_at, b.archived_at as branch_archived_at, b.name as branch, c.name as club, c.discipline as club_discipline
  into link
  from public.registration_links l
  join public.branches b on b.id = l.branch_id
  join public.clubs c on c.id = l.club_id
  where l.token = p_token;
  if not found then
    return query select 'invalid'::text, null::text, null::text, null::text;
  elsif link.disabled_at is not null then
    return query select 'disabled'::text, null::text, null::text, null::text;
  elsif link.expires_at is not null and link.expires_at <= now() then
    return query select 'expired'::text, null::text, null::text, null::text;
  elsif link.branch_archived_at is not null then
    return query select 'branch_archived'::text, null::text, null::text, null::text;
  else
    return query select 'active'::text, link.club, link.club_discipline, link.branch;
  end if;
end;
$$;
revoke all on function public.get_registration_link_info(text) from public;
grant execute on function public.get_registration_link_info(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Public: submit a registration. Creates a *pending* application for the link's own club and
-- branch. p_submission_id (generated when the form is shown) makes retries idempotent.
-- ---------------------------------------------------------------------------

create function public.submit_student_application(
  p_token text, p_submission_id uuid, p_full_name text, p_date_of_birth date, p_gender text,
  p_phone text, p_guardian_name text, p_guardian_phone text, p_notes text
)
returns void language plpgsql security definer set search_path = '' as $$
declare
  link record;
  v_existing uuid;
begin
  select l.id, l.club_id, l.branch_id into link
  from public.registration_links l
  join public.branches b on b.id = l.branch_id
  where l.token = p_token and l.disabled_at is null and (l.expires_at is null or l.expires_at > now()) and b.archived_at is null;
  if not found then
    raise exception 'Registration link unavailable' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_submission_id::text, 0));
  select registration_link_id into v_existing from public.student_applications where id = p_submission_id;
  if found then
    if v_existing = link.id then
      return; -- same submission retried
    end if;
    raise exception 'Submission already used' using errcode = '23505';
  end if;

  if (select count(*) from public.student_applications where registration_link_id = link.id and submitted_at > now() - interval '1 hour') >= 20
     or (select count(*) from public.student_applications where club_id = link.club_id and status = 'pending') >= 500 then
    raise exception 'Too many registrations' using errcode = '54000';
  end if;

  -- Status and review fields take their defaults ('pending', null); the table's checks validate
  -- the submitted details.
  insert into public.student_applications
    (id, club_id, requested_branch_id, registration_link_id, full_name, date_of_birth, gender, phone, guardian_name, guardian_phone, notes)
  values
    (p_submission_id, link.club_id, link.branch_id, link.id, btrim(p_full_name), p_date_of_birth, p_gender,
     nullif(btrim(p_phone), ''), nullif(btrim(p_guardian_name), ''), nullif(btrim(p_guardian_phone), ''), nullif(btrim(p_notes), ''));
end;
$$;
revoke all on function public.submit_student_application(text, uuid, text, date, text, text, text, text, text) from public;
grant execute on function public.submit_student_application(text, uuid, text, date, text, text, text, text, text) to anon, authenticated;
