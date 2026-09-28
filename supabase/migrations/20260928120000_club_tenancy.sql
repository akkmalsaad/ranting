-- Ranting club tenancy: clubs, memberships, branches and students.
--
-- Access model (approved 2026-09-28): any authenticated user may create a club
-- and becomes its owner. Every policy checks membership + role through
-- private.is_club_member(); there is deliberately no owner_id column on clubs.
-- Future roles are added with `alter type public.club_role add value '...'`
-- and by widening the role arrays passed to the helper in new migrations.
--
-- Rollback (local/test only, destroys data):
--   drop function if exists public.create_club(text, text);
--   drop table if exists public.students, public.branches, public.club_members, public.clubs;
--   drop type if exists public.club_role;
--   drop schema if exists private cascade;

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create type public.club_role as enum ('owner');

-- ---------------------------------------------------------------------------
-- Shared trigger helpers
-- ---------------------------------------------------------------------------

create function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.clubs (
  id uuid primary key default gen_random_uuid(),
  name text not null check (name = btrim(name) and char_length(name) between 2 and 120),
  discipline text not null check (discipline = btrim(discipline) and char_length(discipline) between 2 and 80),
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.club_members (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.club_role not null,
  created_at timestamptz not null default now(),
  unique (club_id, user_id)
);

create table public.branches (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs (id) on delete restrict,
  name text not null check (name = btrim(name) and char_length(name) between 2 and 120),
  address text not null default '' check (char_length(address) <= 500),
  archived_at timestamptz,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Target for composite foreign keys that keep child rows inside one club.
  unique (club_id, id)
);

create table public.students (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs (id) on delete restrict,
  branch_id uuid,
  full_name text not null check (full_name = btrim(full_name) and char_length(full_name) between 2 and 120),
  date_of_birth date check (date_of_birth > date '1900-01-01'),
  gender text check (gender in ('male', 'female')),
  phone text check (char_length(phone) <= 20),
  -- Emergency-contact text only. Never used for authorization; verified
  -- guardian/parent links will live in separate tables.
  guardian_name text check (char_length(guardian_name) <= 120),
  guardian_phone text check (char_length(guardian_phone) <= 20),
  status text not null default 'active' check (status in ('active', 'inactive')),
  join_date date not null default ((now() at time zone 'Asia/Kuala_Lumpur')::date),
  notes text check (char_length(notes) <= 2000),
  archived_at timestamptz,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- A student can only reference a branch of the same club.
  foreign key (club_id, branch_id) references public.branches (club_id, id) on delete restrict
);

-- ---------------------------------------------------------------------------
-- Indexes (every foreign key plus membership and list lookups)
-- ---------------------------------------------------------------------------

create index club_members_user_club_idx on public.club_members (user_id, club_id);
create index clubs_created_by_idx on public.clubs (created_by);
create index branches_club_idx on public.branches (club_id, archived_at);
create index branches_created_by_idx on public.branches (created_by);
create unique index branches_club_active_name_key on public.branches (club_id, lower(name)) where archived_at is null;
create index students_club_list_idx on public.students (club_id, archived_at, full_name);
create index students_club_branch_idx on public.students (club_id, branch_id);
create index students_created_by_idx on public.students (created_by);

create trigger clubs_set_updated_at before update on public.clubs
  for each row execute function private.set_updated_at();
create trigger branches_set_updated_at before update on public.branches
  for each row execute function private.set_updated_at();
create trigger students_set_updated_at before update on public.students
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- Authorization helper
-- ---------------------------------------------------------------------------

create function private.is_club_member(p_club_id uuid, p_roles public.club_role[] default null)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.club_members m
    where m.club_id = p_club_id
      and m.user_id = (select auth.uid())
      and (p_roles is null or m.role = any (p_roles))
  );
$$;

revoke all on function private.is_club_member(uuid, public.club_role[]) from public, anon;
grant execute on function private.is_club_member(uuid, public.club_role[]) to authenticated;

-- New assignments must target an active (non-archived) branch. Existing
-- students keep their branch when it is later archived.
create function private.students_require_active_branch()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.branch_id is not null
     and (tg_op = 'INSERT' or new.branch_id is distinct from old.branch_id)
     and exists (select 1 from public.branches b where b.id = new.branch_id and b.archived_at is not null) then
    raise exception 'Branch is archived' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger students_require_active_branch before insert or update of branch_id on public.students
  for each row execute function private.students_require_active_branch();

-- ---------------------------------------------------------------------------
-- Atomic club creation: the club and its owner membership in one transaction.
-- ---------------------------------------------------------------------------

create function public.create_club(p_name text, p_discipline text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_club uuid;
begin
  if v_user is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  insert into public.clubs (name, discipline, created_by)
  values (btrim(p_name), btrim(p_discipline), v_user)
  returning id into v_club;

  insert into public.club_members (club_id, user_id, role)
  values (v_club, v_user, 'owner');

  return v_club;
end;
$$;

revoke all on function public.create_club(text, text) from public, anon;
grant execute on function public.create_club(text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Privileges: anon gets nothing; authenticated gets only what policies allow.
-- ---------------------------------------------------------------------------

revoke all on public.clubs, public.club_members, public.branches, public.students from anon, authenticated;

grant select, delete on public.clubs to authenticated;
grant update (name, discipline) on public.clubs to authenticated;

grant select on public.club_members to authenticated;

grant select, insert, delete on public.branches to authenticated;
grant update (name, address, archived_at) on public.branches to authenticated;

grant select, insert, delete on public.students to authenticated;
grant update (branch_id, full_name, date_of_birth, gender, phone, guardian_name, guardian_phone, status, join_date, notes, archived_at)
  on public.students to authenticated;

-- ---------------------------------------------------------------------------
-- Row Level Security (default deny)
-- ---------------------------------------------------------------------------

alter table public.clubs enable row level security;
alter table public.club_members enable row level security;
alter table public.branches enable row level security;
alter table public.students enable row level security;

-- clubs: inserts only through public.create_club().
create policy clubs_select on public.clubs for select to authenticated
  using (private.is_club_member(id));
create policy clubs_update on public.clubs for update to authenticated
  using (private.is_club_member(id, '{owner}')) with check (private.is_club_member(id, '{owner}'));
create policy clubs_delete on public.clubs for delete to authenticated
  using (private.is_club_member(id, '{owner}'));

-- club_members: read-only for now; nobody can grant themselves a role.
create policy club_members_select on public.club_members for select to authenticated
  using (user_id = (select auth.uid()) or private.is_club_member(club_id));

create policy branches_select on public.branches for select to authenticated
  using (private.is_club_member(club_id, '{owner}'));
create policy branches_insert on public.branches for insert to authenticated
  with check (private.is_club_member(club_id, '{owner}'));
create policy branches_update on public.branches for update to authenticated
  using (private.is_club_member(club_id, '{owner}')) with check (private.is_club_member(club_id, '{owner}'));
create policy branches_delete on public.branches for delete to authenticated
  using (private.is_club_member(club_id, '{owner}'));

create policy students_select on public.students for select to authenticated
  using (private.is_club_member(club_id, '{owner}'));
create policy students_insert on public.students for insert to authenticated
  with check (private.is_club_member(club_id, '{owner}'));
create policy students_update on public.students for update to authenticated
  using (private.is_club_member(club_id, '{owner}')) with check (private.is_club_member(club_id, '{owner}'));
create policy students_delete on public.students for delete to authenticated
  using (private.is_club_member(club_id, '{owner}'));
