-- Multi-child parent registrations: one submission creates one pending application per child,
-- linked by a shared submission id. Requires 20261001100000_registration_links.sql.
--
-- Additive: two nullable columns on student_applications and a new function. Existing
-- applications keep NULL submission ids (shown as standalone) and are not changed.
-- submit_student_application (single child) is kept for compatibility and now delegates to the
-- new function, so both paths share the same checks.
--
-- Guarantees of submit_student_applications:
--   * Atomic: all children of a submission are inserted in one transaction, or none are.
--   * Retry-safe: a submission id can be used once. A retry of a saved submission returns its
--     original child count without inserting or counting anything again.
--   * Abuse limits, checked and consumed under a per-club lock (so concurrent submissions can't
--     both slip past them):
--       - rate limit: a link accepts at most 20 *applications* (children) per rolling hour; a
--         submission that would exceed it is rejected in full (same per-application bound as before);
--       - cap: at most 500 pending applications per club, counting every child;
--       - at most 10 children per submission.
--   * The branch always comes from the link; status is always 'pending'.
--
-- Rollback (local/test only): drop function public.submit_student_applications(text, uuid, text, text, text, jsonb);
--   restore submit_student_application from 20261001100000; drop the two columns and constraints.

alter table public.student_applications
  add column submission_id uuid,
  add column submission_position smallint check (submission_position between 1 and 10),
  add constraint student_applications_submission_position_key unique (submission_id, submission_position),
  add constraint student_applications_submission_complete check ((submission_id is null) = (submission_position is null));

create index student_applications_submission_idx on public.student_applications (club_id, submission_id) where submission_id is not null;

create function public.submit_student_applications(
  p_token text, p_submission_id uuid, p_guardian_name text, p_guardian_phone text, p_notes text, p_children jsonb
)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  link record;
  v_children integer;
  v_existing integer;
  v_same_link boolean;
  v_position integer := 0;
  child jsonb;
begin
  if p_submission_id is null or p_children is null or jsonb_typeof(p_children) <> 'array' then
    raise exception 'Invalid submission' using errcode = '23514';
  end if;
  v_children := jsonb_array_length(p_children);
  if v_children < 1 or v_children > 10 then
    raise exception 'Register between 1 and 10 children' using errcode = '23514';
  end if;

  select l.id, l.club_id, l.branch_id into link
  from public.registration_links l
  join public.branches b on b.id = l.branch_id
  where l.token = p_token and l.disabled_at is null and (l.expires_at is null or l.expires_at > now()) and b.archived_at is null;
  if not found then
    raise exception 'Registration link unavailable' using errcode = '22023';
  end if;

  -- Serialize retries of this submission.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('registration-submission:' || p_submission_id::text, 0));
  -- (id = p_submission_id covers single-child submissions saved before this migration.)
  select count(*), bool_and(registration_link_id = link.id) into v_existing, v_same_link
  from public.student_applications
  where submission_id = p_submission_id or id = p_submission_id;
  if v_existing > 0 then
    if v_same_link then
      return v_existing; -- already saved: report it, count nothing again
    end if;
    raise exception 'Submission already used' using errcode = '23505';
  end if;

  -- Serialize submissions per club so the limits below are checked and consumed atomically.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('registration-club:' || link.club_id::text, 0));
  if (select count(*) from public.student_applications where registration_link_id = link.id and submitted_at > now() - interval '1 hour') + v_children > 20
     or (select count(*) from public.student_applications where club_id = link.club_id and status = 'pending') + v_children > 500 then
    raise exception 'Too many registrations' using errcode = '54000';
  end if;

  for child in select value from jsonb_array_elements(p_children) loop
    v_position := v_position + 1;
    -- Status and review fields take their defaults ('pending', null); table checks validate details.
    insert into public.student_applications
      (club_id, requested_branch_id, registration_link_id, submission_id, submission_position,
       full_name, date_of_birth, gender, phone, guardian_name, guardian_phone, notes)
    values
      (link.club_id, link.branch_id, link.id, p_submission_id, v_position,
       btrim(child ->> 'full_name'), nullif(child ->> 'date_of_birth', '')::date, nullif(child ->> 'gender', ''),
       nullif(btrim(child ->> 'phone'), ''), nullif(btrim(p_guardian_name), ''), nullif(btrim(p_guardian_phone), ''), nullif(btrim(p_notes), ''));
  end loop;
  return v_children;
end;
$$;
revoke all on function public.submit_student_applications(text, uuid, text, text, text, jsonb) from public;
grant execute on function public.submit_student_applications(text, uuid, text, text, text, jsonb) to anon, authenticated;

-- Single-child compatibility wrapper (same signature, grants kept by CREATE OR REPLACE).
create or replace function public.submit_student_application(
  p_token text, p_submission_id uuid, p_full_name text, p_date_of_birth date, p_gender text,
  p_phone text, p_guardian_name text, p_guardian_phone text, p_notes text
)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform public.submit_student_applications(p_token, p_submission_id, p_guardian_name, p_guardian_phone, p_notes,
    pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object('full_name', p_full_name, 'date_of_birth', p_date_of_birth, 'gender', p_gender, 'phone', p_phone)));
end;
$$;
