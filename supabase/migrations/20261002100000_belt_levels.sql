-- Configurable belt levels per club, and each student's current level.
--
-- Additive: a new table, one nullable column on students, a trigger and functions. There was no
-- previous level/grade data, so nothing is migrated. No club gets default levels.
--
-- Integrity:
--   * Levels are referenced by id. students (club_id, belt_level_id) → belt_levels (club_id, id), so a
--     student can only hold a level of their own club; renaming/recolouring shows everywhere.
--   * Progression order (position) is separate from the name and unique per club; moving swaps two
--     positions atomically and never touches student assignments.
--   * Levels are archived, never deleted (no delete grant; FK is ON DELETE RESTRICT). Archived
--     levels stay on students who have them but can't be newly assigned (trigger); re-saving a
--     student with an unchanged archived level is allowed.
-- Access: members of the club can read levels; only owners can create/edit/move/archive them.
-- approve_student_application gains an optional starting level (signature change: drop + create).
-- Public registration functions are unchanged and cannot set a level.
--
-- Rollback (local/test only): restore approve_student_application(uuid, uuid) from 20260930120000;
--   drop functions create_belt_level, move_belt_level; drop trigger + function
--   students_require_active_belt_level; alter table students drop column belt_level_id;
--   drop table belt_levels.

create table public.belt_levels (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs (id) on delete restrict,
  name text not null check (name = btrim(name) and char_length(name) between 1 and 60),
  color text not null check (color ~ '^#[0-9a-f]{6}$'),
  position integer not null check (position >= 1),
  archived_at timestamptz,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (club_id, id),
  constraint belt_levels_club_position_key unique (club_id, position) deferrable initially deferred
);

create unique index belt_levels_club_active_name_key on public.belt_levels (club_id, lower(name)) where archived_at is null;
create index belt_levels_created_by_idx on public.belt_levels (created_by);

create trigger belt_levels_set_updated_at before update on public.belt_levels
  for each row execute function private.set_updated_at();

alter table public.belt_levels enable row level security;
revoke all on public.belt_levels from public, anon, authenticated;
grant select on public.belt_levels to authenticated;
grant update (name, color, archived_at) on public.belt_levels to authenticated;
create policy belt_levels_member_read on public.belt_levels for select to authenticated
  using (private.is_club_member(club_id));
create policy belt_levels_owner_update on public.belt_levels for update to authenticated
  using (private.is_club_member(club_id, '{owner}')) with check (private.is_club_member(club_id, '{owner}'));

-- ---------------------------------------------------------------------------
-- Students: current level
-- ---------------------------------------------------------------------------

alter table public.students
  add column belt_level_id uuid,
  add constraint students_club_id_belt_level_id_fkey foreign key (club_id, belt_level_id) references public.belt_levels (club_id, id) on delete restrict;
create index students_club_belt_level_idx on public.students (club_id, belt_level_id);
grant update (belt_level_id) on public.students to authenticated;

create function private.students_require_active_belt_level()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.belt_level_id is not null
     and (tg_op = 'INSERT' or new.belt_level_id is distinct from old.belt_level_id)
     and exists (select 1 from public.belt_levels l where l.id = new.belt_level_id and l.archived_at is not null) then
    raise exception 'Belt level is archived' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger students_require_active_belt_level before insert or update of belt_level_id on public.students
  for each row execute function private.students_require_active_belt_level();

-- ---------------------------------------------------------------------------
-- Owner functions: create at the end of the order; move up/down among active levels.
-- ---------------------------------------------------------------------------

create function public.create_belt_level(p_club_id uuid, p_name text, p_color text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
begin
  if not private.is_club_member(p_club_id, '{owner}') then
    raise exception 'Not authorized' using errcode = '42501';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('belt-levels:' || p_club_id::text, 0));
  insert into public.belt_levels (club_id, name, color, position, created_by)
  values (p_club_id, btrim(p_name), lower(p_color),
          coalesce((select max(position) from public.belt_levels where club_id = p_club_id), 0) + 1, auth.uid())
  returning id into v_id;
  return v_id;
end;
$$;
revoke all on function public.create_belt_level(uuid, text, text) from public, anon;
grant execute on function public.create_belt_level(uuid, text, text) to authenticated;

-- p_direction: -1 = earlier in the progression, 1 = later. Swaps with the nearest active level.
create function public.move_belt_level(p_level_id uuid, p_direction integer)
returns void language plpgsql security definer set search_path = '' as $$
declare
  level public.belt_levels;
  neighbour public.belt_levels;
begin
  select * into level from public.belt_levels where id = p_level_id;
  if not found or not private.is_club_member(level.club_id, '{owner}') then
    raise exception 'Not authorized' using errcode = '42501';
  end if;
  if p_direction not in (-1, 1) then
    raise exception 'Invalid direction' using errcode = '22023';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('belt-levels:' || level.club_id::text, 0));
  select * into level from public.belt_levels where id = p_level_id; -- re-read under the lock
  if level.archived_at is not null then
    raise exception 'Archived levels cannot be moved' using errcode = '22023';
  end if;
  if p_direction < 0 then
    select * into neighbour from public.belt_levels
    where club_id = level.club_id and archived_at is null and position < level.position order by position desc limit 1;
  else
    select * into neighbour from public.belt_levels
    where club_id = level.club_id and archived_at is null and position > level.position order by position asc limit 1;
  end if;
  if not found then
    return; -- already first/last
  end if;
  -- The (club_id, position) unique constraint is deferred, so the swap is checked at commit.
  update public.belt_levels set position = neighbour.position where id = level.id;
  update public.belt_levels set position = level.position where id = neighbour.id;
end;
$$;
revoke all on function public.move_belt_level(uuid, integer) from public, anon;
grant execute on function public.move_belt_level(uuid, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- Approval with an optional starting level (same locking/idempotency as before).
-- ---------------------------------------------------------------------------

drop function public.approve_student_application(uuid, uuid);

create function public.approve_student_application(p_application_id uuid, p_branch_id uuid, p_belt_level_id uuid default null)
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
  if p_belt_level_id is not null then
    perform 1 from public.belt_levels where id = p_belt_level_id and club_id = app.club_id and archived_at is null for share;
    if not found then
      raise exception 'Choose a current belt level of this club' using errcode = '23514';
    end if;
  end if;
  insert into public.students (club_id, branch_id, belt_level_id, full_name, date_of_birth, gender, phone, guardian_name, guardian_phone, notes, status, created_by)
  values (app.club_id, p_branch_id, p_belt_level_id, app.full_name, app.date_of_birth, app.gender, app.phone, app.guardian_name, app.guardian_phone, app.notes, 'active', auth.uid())
  returning id into v_student;
  update public.student_applications
  set status = 'approved', reviewed_by = auth.uid(), reviewed_at = now(), approved_branch_id = p_branch_id, student_id = v_student
  where id = app.id;
  return v_student;
end;
$$;
revoke all on function public.approve_student_application(uuid, uuid, uuid) from public, anon;
grant execute on function public.approve_student_application(uuid, uuid, uuid) to authenticated;
