-- Weekly recurring classes. Requires 20261003100000_class_sessions.sql.
--
-- Additive. A series records the weekly pattern (weekdays, date range, times). Creating one
-- generates its individual class_sessions rows in the same transaction, so every occurrence has a
-- stable id (for future attendance). Each session can then be edited, completed or cancelled
-- on its own (exceptions); nothing is generated later or automatically.
--
-- Bounded: a series spans at most 366 days (≤ 367 sessions). Weekdays are ISO (1 = Monday … 7 = Sunday).
-- Dates/times are Malaysia wall-clock values, as for class_sessions.
-- Access: members read; owners create (RLS, security-invoker RPC). No update/delete grant on
-- series in this pass; sessions keep their own update rules.
--
-- Rollback (local/test only): drop function public.create_class_series(uuid, uuid, text, smallint[], date, date, time, time, text, text);
--   alter table public.class_sessions drop column series_id; drop table public.class_series;

create table public.class_series (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs (id) on delete restrict,
  branch_id uuid not null,
  name text not null check (name = btrim(name) and char_length(name) between 2 and 120),
  weekdays smallint[] not null check (cardinality(weekdays) between 1 and 7 and weekdays <@ '{1,2,3,4,5,6,7}'::smallint[]),
  start_date date not null check (start_date > date '1900-01-01'),
  end_date date not null check (end_date < date '2200-01-01'),
  start_time time not null,
  end_time time not null,
  instructor_name text check (instructor_name = btrim(instructor_name) and char_length(instructor_name) between 2 and 120),
  notes text check (char_length(notes) <= 2000),
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint class_series_date_range check (end_date > start_date and end_date <= start_date + 366),
  constraint class_series_end_after_start check (end_time > start_time),
  unique (club_id, id),
  foreign key (club_id, branch_id) references public.branches (club_id, id) on delete restrict
);

create index class_series_club_branch_idx on public.class_series (club_id, branch_id);
create index class_series_created_by_idx on public.class_series (created_by);

create trigger class_series_set_updated_at before update on public.class_series
  for each row execute function private.set_updated_at();
-- Same rule as single classes: a new series can't use an archived branch.
create trigger class_series_require_active_branch before insert or update of branch_id on public.class_series
  for each row execute function private.class_sessions_require_active_branch();

alter table public.class_series enable row level security;
revoke all on public.class_series from public, anon, authenticated;
grant select, insert on public.class_series to authenticated;

create policy class_series_member_read on public.class_series for select to authenticated
  using (private.is_club_member(club_id));
create policy class_series_owner_insert on public.class_series for insert to authenticated
  with check (private.is_club_member(club_id, '{owner}'));

-- Sessions generated from a series point back to it (same club enforced by the composite FK).
alter table public.class_sessions add column series_id uuid;
alter table public.class_sessions add constraint class_sessions_club_id_series_id_fkey
  foreign key (club_id, series_id) references public.class_series (club_id, id) on delete restrict;
create index class_sessions_series_date_idx on public.class_sessions (series_id, session_date) where series_id is not null;

-- Creates the series and all its sessions atomically. SECURITY INVOKER: the caller's RLS
-- (owner insert) and the tables' constraints/triggers apply to every row.
create function public.create_class_series(
  p_club_id uuid, p_branch_id uuid, p_name text, p_weekdays smallint[], p_start_date date, p_end_date date,
  p_start_time time, p_end_time time, p_instructor_name text default null, p_notes text default null
)
returns table (new_series_id uuid, new_session_count integer)
language plpgsql security invoker set search_path = '' as $$
declare
  v_id uuid;
  v_count integer;
begin
  insert into public.class_series (club_id, branch_id, name, weekdays, start_date, end_date, start_time, end_time, instructor_name, notes)
  values (p_club_id, p_branch_id, p_name, p_weekdays, p_start_date, p_end_date, p_start_time, p_end_time, p_instructor_name, p_notes)
  returning id into v_id;

  insert into public.class_sessions (club_id, branch_id, series_id, name, session_date, start_time, end_time, instructor_name, notes)
  select p_club_id, p_branch_id, v_id, p_name, d::date, p_start_time, p_end_time, p_instructor_name, p_notes
  from generate_series(p_start_date::timestamp, p_end_date::timestamp, interval '1 day') as d
  where extract(isodow from d)::smallint = any (p_weekdays);
  get diagnostics v_count = row_count;

  if v_count = 0 then
    raise exception 'No class dates in range' using errcode = '23514';
  end if;
  return query select v_id, v_count;
end;
$$;
revoke all on function public.create_class_series(uuid, uuid, text, smallint[], date, date, time, time, text, text) from public, anon;
grant execute on function public.create_class_series(uuid, uuid, text, smallint[], date, date, time, time, text, text) to authenticated;
