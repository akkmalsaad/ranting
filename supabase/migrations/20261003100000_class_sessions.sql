-- Class scheduling: individual (single) class sessions per club branch.
--
-- Additive: one new table with triggers and RLS. No recurring schedules, attendance, fees,
-- notifications or enrolment.
--
-- Time: session_date + start_time/end_time are Malaysia wall-clock values (Asia/Kuala_Lumpur).
-- Storing the local calendar date and times (not UTC instants) avoids timezone shifts in display.
--
-- Integrity: (club_id, branch_id) → branches (club_id, id), so a class can only use its own club's
-- branch; end_time > start_time. New or moved classes can't use an archived branch (trigger);
-- historical classes on since-archived branches are kept. Classes are never deleted (no delete
-- grant): Cancel is a status. Status changes record who/when (trigger); nothing auto-completes.
-- Access: members read; owners create and update (RLS).
--
-- Rollback (local/test only): drop table public.class_sessions;
--   drop function private.class_sessions_require_active_branch(); drop function private.class_sessions_track_status();

create table public.class_sessions (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs (id) on delete restrict,
  branch_id uuid not null,
  name text not null check (name = btrim(name) and char_length(name) between 2 and 120),
  session_date date not null check (session_date > date '1900-01-01' and session_date < date '2200-01-01'),
  start_time time not null,
  end_time time not null,
  instructor_name text check (instructor_name = btrim(instructor_name) and char_length(instructor_name) between 2 and 120),
  notes text check (char_length(notes) <= 2000),
  status text not null default 'scheduled' check (status in ('scheduled', 'completed', 'cancelled')),
  status_changed_at timestamptz,
  status_changed_by uuid references auth.users (id) on delete set null,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint class_sessions_end_after_start check (end_time > start_time),
  foreign key (club_id, branch_id) references public.branches (club_id, id) on delete restrict
);

create index class_sessions_club_date_idx on public.class_sessions (club_id, session_date, start_time);
create index class_sessions_club_branch_date_idx on public.class_sessions (club_id, branch_id, session_date);
create index class_sessions_created_by_idx on public.class_sessions (created_by);
create index class_sessions_status_changed_by_idx on public.class_sessions (status_changed_by);

create trigger class_sessions_set_updated_at before update on public.class_sessions
  for each row execute function private.set_updated_at();

-- New or moved classes must use a current (non-archived) branch.
create function private.class_sessions_require_active_branch()
returns trigger language plpgsql set search_path = '' as $$
begin
  if (tg_op = 'INSERT' or new.branch_id is distinct from old.branch_id)
     and exists (select 1 from public.branches b where b.id = new.branch_id and b.archived_at is not null) then
    raise exception 'Branch is archived' using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger class_sessions_require_active_branch before insert or update of branch_id on public.class_sessions
  for each row execute function private.class_sessions_require_active_branch();

-- Record who changed a session's status and when (never set by clients).
create function private.class_sessions_track_status()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.status is distinct from old.status then
    new.status_changed_at := now();
    new.status_changed_by := auth.uid();
  else
    new.status_changed_at := old.status_changed_at;
    new.status_changed_by := old.status_changed_by;
  end if;
  return new;
end;
$$;
create trigger class_sessions_track_status before update on public.class_sessions
  for each row execute function private.class_sessions_track_status();

alter table public.class_sessions enable row level security;
revoke all on public.class_sessions from public, anon, authenticated;
grant select, insert on public.class_sessions to authenticated;
grant update (branch_id, name, session_date, start_time, end_time, instructor_name, notes, status) on public.class_sessions to authenticated;

create policy class_sessions_member_read on public.class_sessions for select to authenticated
  using (private.is_club_member(club_id));
create policy class_sessions_owner_insert on public.class_sessions for insert to authenticated
  with check (private.is_club_member(club_id, '{owner}'));
create policy class_sessions_owner_update on public.class_sessions for update to authenticated
  using (private.is_club_member(club_id, '{owner}')) with check (private.is_club_member(club_id, '{owner}'));
