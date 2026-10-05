-- Branch colour and short code, used by the Classes calendar (chips, legend, branch form preview).
--
-- Additive: two nullable columns, a club-scoped unique index, a column update grant and a one-off
-- backfill. Access is unchanged: owner-only branch RLS; owners set the new columns through the
-- existing branches_insert/branches_update policies plus the column grant below.
--
-- color: a key from the app's fixed palette (src/lib/branch-colors.ts), never free hex. Backfilled
--   with the colour each branch already shows: palette[(position of the branch's id among its club's
--   branch ids) mod 8], which is the app's branchColors() fallback. (The app sorts canonical
--   lowercase uuid strings; Postgres orders uuids bytewise, which is the same order.)
-- short_code: 2–4 uppercase letters/digits, unique per club. Archived branches count too, so
--   restoring a branch never collides. Backfilled from the name's initials ("Bukit Antarabangsa" →
--   "BA"; a one-word name uses its first two characters, "Setapak" → "SE"); duplicates within a
--   club get a number ("BA", "BA2", ...), oldest branch first.
-- The backfill doesn't touch updated_at (that trigger is disabled for the update only).
--
-- Rollback (local/test only):
--   drop index public.branches_club_short_code_key;
--   alter table public.branches drop column short_code, drop column color;

alter table public.branches
  add column short_code text check (short_code ~ '^[A-Z0-9]{2,4}$'),
  add column color text check (color in ('teal', 'violet', 'amber', 'sky', 'rose', 'emerald', 'indigo', 'orange'));

-- NULLs are distinct, so branches without a code don't conflict.
create unique index branches_club_short_code_key on public.branches (club_id, short_code);

alter table public.branches disable trigger branches_set_updated_at;

update public.branches b
set color = (array['teal', 'violet', 'amber', 'sky', 'rose', 'emerald', 'indigo', 'orange'])[((r.position - 1) % 8) + 1]
from (select id, row_number() over (partition by club_id order by id) as position from public.branches) r
where r.id = b.id and b.color is null;

do $$
declare
  b record;
  base text;
  candidate text;
  n int;
begin
  for b in select id, club_id, name from public.branches where short_code is null order by club_id, created_at, id loop
    -- Initials of each word (Latin letters and digits; anything else separates words).
    select coalesce(string_agg(left(word, 1), '' order by ord), '') into base
    from regexp_split_to_table(upper(b.name), '[^A-Z0-9]+') with ordinality as t(word, ord)
    where word <> '';
    if char_length(base) < 2 then
      base := left(regexp_replace(upper(b.name), '[^A-Z0-9]', '', 'g'), 2);
    end if;
    base := left(base, 4);
    if char_length(base) < 2 then
      base := 'BR'; -- a name without Latin letters or digits
    end if;
    candidate := base;
    n := 1;
    while exists (select 1 from public.branches x where x.club_id = b.club_id and x.short_code = candidate) loop
      n := n + 1;
      candidate := left(base, 4 - char_length(n::text)) || n;
    end loop;
    update public.branches set short_code = candidate where id = b.id;
  end loop;
end $$;

alter table public.branches enable trigger branches_set_updated_at;

grant update (short_code, color) on public.branches to authenticated;
