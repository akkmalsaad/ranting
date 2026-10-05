-- Optional stripe colour on belt levels (one lengthwise stripe). Requires 20261002100000_belt_levels.sql.
--
-- Additive: one nullable column; existing levels keep NULL and stay plain belts. Level ids,
-- student assignments, positions, archiving and access rules are unchanged. Owners edit the stripe
-- through the same owner-only update policy (column grant below). create_belt_level gains an
-- optional stripe argument (signature change: drop + create, same checks and locking).
--
-- Rollback (local/test only): restore create_belt_level(uuid, text, text) from 20261002100000;
--   alter table public.belt_levels drop column stripe_color;

alter table public.belt_levels
  add column stripe_color text check (stripe_color ~ '^#[0-9a-f]{6}$');

grant update (stripe_color) on public.belt_levels to authenticated;

drop function public.create_belt_level(uuid, text, text);

create function public.create_belt_level(p_club_id uuid, p_name text, p_color text, p_stripe_color text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
begin
  if not private.is_club_member(p_club_id, '{owner}') then
    raise exception 'Not authorized' using errcode = '42501';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('belt-levels:' || p_club_id::text, 0));
  insert into public.belt_levels (club_id, name, color, stripe_color, position, created_by)
  values (p_club_id, btrim(p_name), lower(p_color), lower(nullif(btrim(p_stripe_color), '')),
          coalesce((select max(position) from public.belt_levels where club_id = p_club_id), 0) + 1, auth.uid())
  returning id into v_id;
  return v_id;
end;
$$;
revoke all on function public.create_belt_level(uuid, text, text, text) from public, anon;
grant execute on function public.create_belt_level(uuid, text, text, text) to authenticated;
