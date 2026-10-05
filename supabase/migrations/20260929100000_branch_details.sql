-- Structured branch address and branch coach contact, for sharing branch details with parents.
--
-- Additive only: no data is dropped. `address` is kept: the app now writes it as the formatted
-- one-line display address (shown on branch cards) from the structured fields below.
-- Access is unchanged: owner-only branch RLS policies; new columns are added to the owner-only
-- column update grant, and inserts already go through the owner-only insert policy.
--
-- Coach details are plain contact text on the branch (like guardian contact on students), not a
-- staff account or login, and never used for authorization.
--
-- Rollback (local/test only): alter table public.branches drop column address_line1, drop column
--   address_line2, drop column postcode, drop column city, drop column state, drop column coach_name,
--   drop column coach_phone, drop column coach_role, drop column coach_email;

alter table public.branches
  add column address_line1 text check (char_length(address_line1) <= 200),
  add column address_line2 text check (char_length(address_line2) <= 200),
  -- Not tied to one country's format: letters, digits, spaces and hyphens (Malaysia: 5 digits).
  add column postcode text check (postcode ~ '^[A-Za-z0-9 -]{3,10}$'),
  add column city text check (char_length(city) between 2 and 100),
  -- Region code/slug; the app currently offers Malaysian states and federal territories.
  add column state text check (char_length(state) between 2 and 100),
  add column coach_name text check (char_length(coach_name) between 2 and 120),
  add column coach_phone text check (coach_phone ~ '^\+?[0-9]{9,15}$'),
  add column coach_role text check (char_length(coach_role) between 2 and 80),
  add column coach_email text check (char_length(coach_email) <= 254 and coach_email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$');

-- Existing single-line addresses become address line 1 so the edit form shows them. Longer or
-- multi-line addresses stay in `address` only, untouched, until the owner edits the branch.
update public.branches
set address_line1 = btrim(address)
where address_line1 is null
  and btrim(address) <> ''
  and char_length(btrim(address)) <= 200
  and position(E'\n' in address) = 0;

grant update (
  address_line1, address_line2, postcode, city, state,
  coach_name, coach_phone, coach_role, coach_email
) on public.branches to authenticated;
