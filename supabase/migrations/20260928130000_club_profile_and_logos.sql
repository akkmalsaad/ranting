-- Optional club profile details and a private, club-scoped logo bucket.
--
-- Access is unchanged: profile columns are edited through the existing owner-only
-- clubs_update RLS policy (column-level grants below). Logo objects live under
-- `<club_id>/...` in the private `club-logos` bucket; members can read, owners can write.
--
-- Rollback (local/test only):
--   drop policy if exists club_logos_select on storage.objects; (and _insert, _update, _delete)
--   delete from storage.buckets where id = 'club-logos';  -- after removing its objects
--   drop function if exists private.club_id_from_object_name(text);
--   alter table public.clubs drop constraint clubs_logo_path_in_club_folder,
--     drop column ros_number, drop column sports_commissioner_number, drop column ssm_number,
--     drop column association, drop column address_line1, drop column address_line2,
--     drop column postcode, drop column city, drop column state, drop column phone,
--     drop column email, drop column year_founded, drop column logo_path;

-- ---------------------------------------------------------------------------
-- Club profile columns (all optional)
-- ---------------------------------------------------------------------------

alter table public.clubs
  add column ros_number text check (char_length(ros_number) between 2 and 50),
  add column sports_commissioner_number text check (char_length(sports_commissioner_number) between 2 and 50),
  add column ssm_number text check (char_length(ssm_number) between 2 and 50),
  add column association text check (char_length(association) between 2 and 120),
  add column address_line1 text check (char_length(address_line1) <= 200),
  add column address_line2 text check (char_length(address_line2) <= 200),
  add column postcode text check (postcode ~ '^[0-9]{5}$'),
  add column city text check (char_length(city) between 2 and 100),
  add column state text check (state in (
    'johor', 'kedah', 'kelantan', 'melaka', 'negeri-sembilan', 'pahang', 'perak', 'perlis',
    'pulau-pinang', 'sabah', 'sarawak', 'selangor', 'terengganu',
    'kuala-lumpur', 'labuan', 'putrajaya'
  )),
  -- Stored normalized: digits with an optional leading + (the app accepts common Malaysian formats).
  add column phone text check (phone ~ '^\+?[0-9]{9,15}$'),
  add column email text check (char_length(email) <= 254 and email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  add column year_founded smallint check (year_founded between 1900 and 2100),
  add column logo_path text check (char_length(logo_path) <= 300),
  -- A club can only point at an object in its own folder.
  add constraint clubs_logo_path_in_club_folder check (logo_path is null or logo_path like (id::text || '/%'));

grant update (
  ros_number, sports_commissioner_number, ssm_number, association,
  address_line1, address_line2, postcode, city, state, phone, email, year_founded, logo_path
) on public.clubs to authenticated;

-- ---------------------------------------------------------------------------
-- Logo storage
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('club-logos', 'club-logos', false, 2097152, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do nothing;

-- Club id from an object path's first folder; null for anything that isn't a uuid.
create function private.club_id_from_object_name(p_name text)
returns uuid
language sql
immutable
set search_path = ''
as $$
  select case
    when split_part(p_name, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    then split_part(p_name, '/', 1)::uuid
  end;
$$;

revoke all on function private.club_id_from_object_name(text) from public, anon;
grant execute on function private.club_id_from_object_name(text) to authenticated;

create policy club_logos_select on storage.objects for select to authenticated
  using (bucket_id = 'club-logos' and private.is_club_member(private.club_id_from_object_name(name)));
create policy club_logos_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'club-logos' and private.is_club_member(private.club_id_from_object_name(name), '{owner}'));
create policy club_logos_update on storage.objects for update to authenticated
  using (bucket_id = 'club-logos' and private.is_club_member(private.club_id_from_object_name(name), '{owner}'))
  with check (bucket_id = 'club-logos' and private.is_club_member(private.club_id_from_object_name(name), '{owner}'));
create policy club_logos_delete on storage.objects for delete to authenticated
  using (bucket_id = 'club-logos' and private.is_club_member(private.club_id_from_object_name(name), '{owner}'));
