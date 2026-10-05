-- One-off fees for several students at once, plus a Yearly fee type.
--
-- Additive:
-- - student_fees.fee_type accepts 'yearly' (a one-off annual charge; nothing recurs). The check is
--   replaced with a superset, so every existing row stays valid.
-- - student_fees.batch_id (nullable) links fees created together; existing fees keep NULL.
-- - create_fee_batch(): creates one fee per student in a single transaction (all or nothing),
--   idempotent by the batch id. Monthly fees stay with generate_monthly_fees and its one-per-month
--   rule; one-off fees may repeat for the same student and month.
-- Paid yearly fees use the existing 'other_income' Finance category (the fee_income_category
-- fallback), so no category or Finance change is needed. RLS, grants and existing functions are
-- unchanged.
--
-- Recovery: roll the app back first, then drop create_fee_batch. Keep the column and the wider
-- check while any fee uses them.

alter table public.student_fees drop constraint student_fees_fee_type_check;
alter table public.student_fees add constraint student_fees_fee_type_check
  check (fee_type in ('monthly', 'yearly', 'registration', 'grading', 'uniform', 'event', 'other'));

alter table public.student_fees add column batch_id uuid;
create index student_fees_batch_idx on public.student_fees (batch_id) where batch_id is not null;

-- p_items = [{"student_id": uuid, "amount_sen": int}], 1–500 distinct students. Each fee captures the
-- student's current branch (NULL = club-level). The student_fees_require_active trigger rejects a
-- student who isn't active and current or whose branch is archived, which fails the whole batch.
-- An identical retry returns the fees already created; any other reuse of p_batch_id fails.
create function public.create_fee_batch(p_batch_id uuid, p_club_id uuid, p_fee_type text, p_title text, p_billing_month date, p_due_date date, p_items jsonb, p_notes text default null)
returns table(result_student_id uuid, result_fee_id uuid)
language plpgsql security definer set search_path = '' as $$
declare
  item jsonb;
  sid uuid;
  amount integer;
  student_branch uuid;
  new_id uuid;
  clean_title text := pg_catalog.btrim(p_title);
  clean_notes text := nullif(pg_catalog.btrim(p_notes), '');
begin
  perform private.require_club_owner(p_club_id);
  if p_fee_type is null or p_fee_type = 'monthly' then
    raise exception 'Use Generate monthly fees for monthly fees' using errcode = '22023';
  end if;
  if p_items is null or pg_catalog.jsonb_typeof(p_items) <> 'array' or pg_catalog.jsonb_array_length(p_items) not between 1 and 500 then
    raise exception 'Choose between 1 and 500 students' using errcode = '22023';
  end if;
  if (select pg_catalog.count(distinct e.value ->> 'student_id') from pg_catalog.jsonb_array_elements(p_items) e) <> pg_catalog.jsonb_array_length(p_items) then
    raise exception 'Each student can appear only once' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_batch_id::text, 0));
  if exists (select 1 from public.student_fees f where f.batch_id = p_batch_id) then
    if exists (select 1 from public.student_fees f where f.batch_id = p_batch_id and (f.club_id <> p_club_id or f.created_by <> auth.uid()
          or f.fee_type <> p_fee_type or f.title <> clean_title or f.billing_month <> p_billing_month or f.due_date <> p_due_date or f.notes is distinct from clean_notes))
      or (select pg_catalog.count(*) from public.student_fees f where f.batch_id = p_batch_id) <> pg_catalog.jsonb_array_length(p_items)
      or exists (select 1 from pg_catalog.jsonb_array_elements(p_items) e where not exists (
          select 1 from public.student_fees f where f.batch_id = p_batch_id and f.student_id = (e.value ->> 'student_id')::uuid and f.amount_sen = (e.value ->> 'amount_sen')::integer)) then
      raise exception 'Submission already used' using errcode = '23505';
    end if;
    return query select f.student_id, f.id from public.student_fees f where f.batch_id = p_batch_id;
    return;
  end if;

  for item in select e.value from pg_catalog.jsonb_array_elements(p_items) e loop
    sid := (item ->> 'student_id')::uuid;
    amount := (item ->> 'amount_sen')::integer;
    select s.branch_id into student_branch from public.students s where s.club_id = p_club_id and s.id = sid;
    if not found then
      raise exception 'Student not found' using errcode = '23503';
    end if;
    insert into public.student_fees (club_id, student_id, branch_id, fee_type, title, billing_month, due_date, amount_sen, notes, batch_id)
    values (p_club_id, sid, student_branch, p_fee_type, clean_title, p_billing_month, p_due_date, amount, clean_notes, p_batch_id)
    returning id into new_id;
    insert into public.fee_audit_events (club_id, fee_id, action, details)
    values (p_club_id, new_id, 'created', pg_catalog.jsonb_build_object('amount_sen', amount, 'fee_type', p_fee_type, 'billing_month', p_billing_month, 'branch_id', student_branch, 'batch_id', p_batch_id));
    result_student_id := sid;
    result_fee_id := new_id;
    return next;
  end loop;
end;
$$;
revoke all on function public.create_fee_batch(uuid, uuid, text, text, date, date, jsonb, text) from public, anon;
grant execute on function public.create_fee_batch(uuid, uuid, text, text, date, date, jsonb, text) to authenticated;
