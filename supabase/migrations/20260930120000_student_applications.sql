-- Student registration applications with an owner approval workflow.
--
-- Additive: a new table and two functions; existing students and records are untouched and are
-- NOT marked pending. An application is only a request: it never counts as a student and creates
-- no fees. A student record is created only when an owner approves it.
--
-- There is deliberately no insert path yet: the public parent registration link/form (with its
-- own validation and abuse protection) is a separate, not-yet-designed feature. When it is built,
-- it must insert through a narrow function that can only set the submitted fields (status stays
-- 'pending'; review fields cannot be set) — never via a table grant.
--
-- Access: owners of the club can read applications (RLS). No insert/update/delete grants; review
-- happens only through approve_/reject_student_application, which re-check ownership.
--
-- Rollback (local/test only): drop function public.approve_student_application(uuid, uuid);
--   drop function public.reject_student_application(uuid, text); drop table public.student_applications;
--   alter table public.students drop constraint students_club_id_id_key;

-- Target for the application → student composite foreign key (keeps both in the same club).
alter table public.students add constraint students_club_id_id_key unique (club_id, id);

create table public.student_applications (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs (id) on delete restrict,
  requested_branch_id uuid,
  -- Submitted details: same fields and limits as public.students.
  full_name text not null check (full_name = btrim(full_name) and char_length(full_name) between 2 and 120),
  date_of_birth date check (date_of_birth > date '1900-01-01'),
  gender text check (gender in ('male', 'female')),
  phone text check (char_length(phone) <= 20),
  guardian_name text check (char_length(guardian_name) <= 120),
  guardian_phone text check (char_length(guardian_phone) <= 20),
  notes text check (char_length(notes) <= 2000),
  submitted_at timestamptz not null default now(),
  -- Review (set only by the review functions).
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reviewed_by uuid references auth.users (id) on delete restrict,
  reviewed_at timestamptz,
  rejection_reason text check (char_length(rejection_reason) <= 500), -- internal; owners only
  approved_branch_id uuid,
  student_id uuid unique,
  foreign key (club_id, requested_branch_id) references public.branches (club_id, id) on delete restrict,
  foreign key (club_id, approved_branch_id) references public.branches (club_id, id) on delete restrict,
  foreign key (club_id, student_id) references public.students (club_id, id) on delete restrict,
  constraint student_applications_review_state check (
    (status = 'pending' and reviewed_by is null and reviewed_at is null and student_id is null and rejection_reason is null and approved_branch_id is null)
    or (status = 'approved' and reviewed_by is not null and reviewed_at is not null and student_id is not null and rejection_reason is null)
    or (status = 'rejected' and reviewed_by is not null and reviewed_at is not null and student_id is null and approved_branch_id is null)
  )
);

create index student_applications_club_status_idx on public.student_applications (club_id, status, submitted_at desc);
create index student_applications_requested_branch_idx on public.student_applications (club_id, requested_branch_id);
create index student_applications_approved_branch_idx on public.student_applications (club_id, approved_branch_id);
create index student_applications_reviewer_idx on public.student_applications (reviewed_by);

alter table public.student_applications enable row level security;
revoke all on public.student_applications from public, anon, authenticated;
grant select on public.student_applications to authenticated;
create policy student_applications_owner_read on public.student_applications for select to authenticated
  using (private.is_club_member(club_id, '{owner}'));

-- ---------------------------------------------------------------------------
-- Approve: atomic and retry-safe. The application row is locked, so simultaneous or repeated
-- approvals serialize; a repeat returns the student created by the first approval.
-- ---------------------------------------------------------------------------

create function public.approve_student_application(p_application_id uuid, p_branch_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_club uuid;
  app public.student_applications;
  v_student uuid;
begin
  select club_id into v_club from public.student_applications where id = p_application_id;
  if v_club is null or not private.is_club_member(v_club, '{owner}') then
    raise exception 'Not authorized' using errcode = '42501';
  end if;
  select * into app from public.student_applications where id = p_application_id for update;
  if app.status = 'approved' then
    return app.student_id;
  end if;
  if app.status = 'rejected' then
    raise exception 'Application already rejected' using errcode = '22023';
  end if;
  if p_branch_id is not null then
    perform 1 from public.branches where id = p_branch_id and club_id = app.club_id and archived_at is null for share;
    if not found then
      raise exception 'Choose a current branch of this club' using errcode = '23514';
    end if;
  end if;
  insert into public.students (club_id, branch_id, full_name, date_of_birth, gender, phone, guardian_name, guardian_phone, notes, status, created_by)
  values (app.club_id, p_branch_id, app.full_name, app.date_of_birth, app.gender, app.phone, app.guardian_name, app.guardian_phone, app.notes, 'active', auth.uid())
  returning id into v_student;
  update public.student_applications
  set status = 'approved', reviewed_by = auth.uid(), reviewed_at = now(), approved_branch_id = p_branch_id, student_id = v_student
  where id = app.id;
  return v_student;
end;
$$;
revoke all on function public.approve_student_application(uuid, uuid) from public, anon;
grant execute on function public.approve_student_application(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Reject: keeps the application for reference with its review details. Idempotent.
-- ---------------------------------------------------------------------------

create function public.reject_student_application(p_application_id uuid, p_reason text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_club uuid;
  app public.student_applications;
begin
  select club_id into v_club from public.student_applications where id = p_application_id;
  if v_club is null or not private.is_club_member(v_club, '{owner}') then
    raise exception 'Not authorized' using errcode = '42501';
  end if;
  select * into app from public.student_applications where id = p_application_id for update;
  if app.status = 'rejected' then
    return app.id;
  end if;
  if app.status = 'approved' then
    raise exception 'Application already approved' using errcode = '22023';
  end if;
  update public.student_applications
  set status = 'rejected', reviewed_by = auth.uid(), reviewed_at = now(), rejection_reason = nullif(btrim(p_reason), '')
  where id = app.id;
  return app.id;
end;
$$;
revoke all on function public.reject_student_application(uuid, text) from public, anon;
grant execute on function public.reject_student_application(uuid, text) to authenticated;
