-- Student fees: charges per student, payments allocated to them, and an audit log.
--
-- Additive: three new tables, triggers and functions, plus one unique constraint on
-- payments_received (club_id, id) as the target of a same-club foreign key. Existing rows,
-- policies and functions are unchanged; no data is backfilled.
--
-- Model
-- - student_fees: one charge for one student of one club. branch_id is captured when the fee is
--   created (NULL = club-level) and is never moved when the student later changes branch.
--   Amounts are integer sen. Fees are voided (with actor, time and reason), never deleted.
-- - fee_allocations: an amount of a Finance receipt (payments_received) applied to a fee. A fee
--   payment creates exactly one receipt plus its allocation in one transaction; an existing receipt
--   can be linked instead. Allocations are reversed (audited), never deleted. Paid = the sum of
--   unreversed allocations; balance = amount - paid.
-- - fee_audit_events: who did what to a fee (created, updated, voided, payment recorded, receipt
--   linked, allocation reversed).
--
-- Security: RLS on, owner-only SELECT, no insert/update/delete grants. Every write goes through
-- a SECURITY DEFINER function that checks owner membership; triggers enforce the financial rules
-- for any write path (no overpayment of a fee or a receipt, no allocation to a voided fee, no void
-- or financial edit below the paid amount). Rows reference students, branches and receipts of the
-- same club through composite foreign keys, all ON DELETE RESTRICT.
--
-- Recovery: roll the app back first. These tables hold financial history, so never drop them to
-- roll back; the functions can be dropped or replaced safely.

alter table public.payments_received add constraint payments_received_club_id_id_key unique (club_id, id);

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.student_fees (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs (id) on delete restrict,
  student_id uuid not null,
  branch_id uuid,
  fee_type text not null check (fee_type in ('monthly', 'registration', 'grading', 'uniform', 'event', 'other')),
  title text not null check (title = btrim(title) and char_length(title) between 2 and 120),
  -- Billing period: the first day of the billed calendar month.
  billing_month date not null check (billing_month = date_trunc('month', billing_month)::date and billing_month >= date '1900-01-01'),
  due_date date not null check (due_date >= date '1900-01-01' and due_date <= date '2199-12-31'),
  amount_sen integer not null check (amount_sen between 1 and 999999999),
  notes text check (notes = btrim(notes) and char_length(notes) between 1 and 1000),
  created_by uuid not null default auth.uid() references auth.users (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete restrict,
  updated_at timestamptz,
  voided_at timestamptz,
  voided_by uuid references auth.users (id) on delete restrict,
  void_reason text check (void_reason = btrim(void_reason) and char_length(void_reason) between 3 and 500),
  constraint student_fees_void_state check ((voided_at is null) = (voided_by is null) and (voided_at is null) = (void_reason is null)),
  constraint student_fees_club_id_id_key unique (club_id, id),
  constraint student_fees_club_id_student_id_fkey foreign key (club_id, student_id) references public.students (club_id, id) on delete restrict,
  constraint student_fees_club_id_branch_id_fkey foreign key (club_id, branch_id) references public.branches (club_id, id) on delete restrict
);

-- One standard monthly fee per student and billing month (voided fees don't count). Concurrent
-- requests and retries hit this index; generation uses ON CONFLICT DO NOTHING against it.
create unique index student_fees_one_monthly_key on public.student_fees (club_id, student_id, billing_month) where fee_type = 'monthly' and voided_at is null;
create index student_fees_club_month_idx on public.student_fees (club_id, billing_month, due_date);
create index student_fees_club_due_idx on public.student_fees (club_id, due_date) where voided_at is null;
create index student_fees_student_idx on public.student_fees (club_id, student_id);
create index student_fees_branch_idx on public.student_fees (club_id, branch_id);
create index student_fees_created_by_idx on public.student_fees (created_by);
create index student_fees_updated_by_idx on public.student_fees (updated_by);
create index student_fees_voided_by_idx on public.student_fees (voided_by);

create table public.fee_allocations (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs (id) on delete restrict,
  fee_id uuid not null,
  receipt_id uuid not null,
  amount_sen integer not null check (amount_sen between 1 and 999999999),
  -- fee_payment: recorded from Fees (its receipt was created with it); linked_receipt: an existing
  -- Finance receipt linked by the owner.
  source text not null check (source in ('fee_payment', 'linked_receipt')),
  method text check (method in ('cash', 'bank_transfer', 'other')),
  reference text check (reference = btrim(reference) and char_length(reference) between 1 and 100),
  notes text check (notes = btrim(notes) and char_length(notes) between 1 and 500),
  created_by uuid not null default auth.uid() references auth.users (id) on delete restrict,
  created_at timestamptz not null default now(),
  reversed_at timestamptz,
  reversed_by uuid references auth.users (id) on delete restrict,
  reversal_reason text check (reversal_reason = btrim(reversal_reason) and char_length(reversal_reason) between 3 and 500),
  constraint fee_allocations_method_source check ((source = 'fee_payment') = (method is not null)),
  constraint fee_allocations_reversal_state check ((reversed_at is null) = (reversed_by is null) and (reversed_at is null) = (reversal_reason is null)),
  constraint fee_allocations_club_id_fee_id_fkey foreign key (club_id, fee_id) references public.student_fees (club_id, id) on delete restrict,
  constraint fee_allocations_club_id_receipt_id_fkey foreign key (club_id, receipt_id) references public.payments_received (club_id, id) on delete restrict
);
-- A receipt recorded from Fees belongs to exactly one fee payment.
create unique index fee_allocations_one_payment_receipt_key on public.fee_allocations (receipt_id) where source = 'fee_payment';
create index fee_allocations_fee_idx on public.fee_allocations (club_id, fee_id) where reversed_at is null;
create index fee_allocations_receipt_idx on public.fee_allocations (club_id, receipt_id) where reversed_at is null;
create index fee_allocations_created_by_idx on public.fee_allocations (created_by);
create index fee_allocations_reversed_by_idx on public.fee_allocations (reversed_by);

create table public.fee_audit_events (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs (id) on delete restrict,
  fee_id uuid not null,
  allocation_id uuid references public.fee_allocations (id) on delete restrict,
  action text not null check (action in ('created', 'updated', 'voided', 'payment_recorded', 'receipt_linked', 'allocation_reversed')),
  details jsonb not null default '{}'::jsonb,
  actor uuid not null default auth.uid() references auth.users (id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint fee_audit_events_club_id_fee_id_fkey foreign key (club_id, fee_id) references public.student_fees (club_id, id) on delete restrict
);
create index fee_audit_events_fee_idx on public.fee_audit_events (club_id, fee_id, created_at);
create index fee_audit_events_allocation_idx on public.fee_audit_events (allocation_id);
create index fee_audit_events_actor_idx on public.fee_audit_events (actor);

-- ---------------------------------------------------------------------------
-- RLS: owner-only reads; no direct writes.
-- ---------------------------------------------------------------------------

alter table public.student_fees enable row level security;
alter table public.fee_allocations enable row level security;
alter table public.fee_audit_events enable row level security;
create policy student_fees_owner_read on public.student_fees for select to authenticated using (private.is_club_member(club_id, '{owner}'));
create policy fee_allocations_owner_read on public.fee_allocations for select to authenticated using (private.is_club_member(club_id, '{owner}'));
create policy fee_audit_events_owner_read on public.fee_audit_events for select to authenticated using (private.is_club_member(club_id, '{owner}'));
revoke all on public.student_fees, public.fee_allocations, public.fee_audit_events from anon, authenticated;
grant select on public.student_fees, public.fee_allocations, public.fee_audit_events to authenticated;

-- ---------------------------------------------------------------------------
-- Triggers: financial rules for every write path.
-- ---------------------------------------------------------------------------

-- New charges: an active, current student and a current branch (or club-level).
create function private.student_fees_require_active() returns trigger language plpgsql set search_path = '' as $$
begin
  if not exists (select 1 from public.students s where s.club_id = new.club_id and s.id = new.student_id and s.archived_at is null and s.status = 'active') then
    raise exception 'Student must be active' using errcode = '23514';
  end if;
  if new.branch_id is not null and not exists (select 1 from public.branches b where b.club_id = new.club_id and b.id = new.branch_id and b.archived_at is null) then
    raise exception 'Choose a current branch of this club' using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger student_fees_require_active before insert on public.student_fees for each row execute function private.student_fees_require_active();

-- Updates: the student and club never change; with unreversed payments the amount, type,
-- billing month and branch are fixed and the fee can't be voided; voided fees are final.
create function private.student_fees_guard() returns trigger language plpgsql set search_path = '' as $$
declare
  paid bigint;
begin
  if new.club_id <> old.club_id or new.student_id <> old.student_id or new.id <> old.id or new.created_by <> old.created_by or new.created_at <> old.created_at then
    raise exception 'Fee ownership cannot change' using errcode = '23514';
  end if;
  if old.voided_at is not null then
    raise exception 'Fee is voided' using errcode = '23514';
  end if;
  select coalesce(sum(a.amount_sen), 0) into paid from public.fee_allocations a where a.club_id = old.club_id and a.fee_id = old.id and a.reversed_at is null;
  if paid > 0 and (new.amount_sen <> old.amount_sen or new.fee_type <> old.fee_type or new.billing_month <> old.billing_month or new.branch_id is distinct from old.branch_id) then
    raise exception 'Fee has payments' using errcode = '23514';
  end if;
  if paid > 0 and new.voided_at is not null then
    raise exception 'Fee has payments' using errcode = '23514';
  end if;
  if new.branch_id is distinct from old.branch_id and new.branch_id is not null and not exists (select 1 from public.branches b where b.club_id = new.club_id and b.id = new.branch_id and b.archived_at is null) then
    raise exception 'Choose a current branch of this club' using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger student_fees_guard before update on public.student_fees for each row execute function private.student_fees_guard();

-- New allocations: lock the fee then the receipt (always in that order) and keep both within
-- their amounts, so concurrent payments can't overpay a fee or over-allocate a receipt.
create function private.fee_allocations_guard() returns trigger language plpgsql set search_path = '' as $$
declare
  fee_amount integer;
  fee_voided timestamptz;
  receipt_amount integer;
  fee_paid bigint;
  receipt_used bigint;
begin
  select f.amount_sen, f.voided_at into fee_amount, fee_voided from public.student_fees f where f.club_id = new.club_id and f.id = new.fee_id for update;
  if not found then raise exception 'Fee not found' using errcode = '23503'; end if;
  if fee_voided is not null then raise exception 'Fee is voided' using errcode = '23514'; end if;
  select r.amount_sen into receipt_amount from public.payments_received r where r.club_id = new.club_id and r.id = new.receipt_id for update;
  if not found then raise exception 'Receipt not found' using errcode = '23503'; end if;
  select coalesce(sum(a.amount_sen), 0) into fee_paid from public.fee_allocations a where a.club_id = new.club_id and a.fee_id = new.fee_id and a.reversed_at is null;
  if fee_paid + new.amount_sen > fee_amount then
    raise exception 'Amount exceeds the fee balance' using errcode = '23514';
  end if;
  select coalesce(sum(a.amount_sen), 0) into receipt_used from public.fee_allocations a where a.club_id = new.club_id and a.receipt_id = new.receipt_id and a.reversed_at is null;
  if receipt_used + new.amount_sen > receipt_amount then
    raise exception 'Amount exceeds the receipt available amount' using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger fee_allocations_guard before insert on public.fee_allocations for each row execute function private.fee_allocations_guard();

-- Allocation updates: only a one-time reversal.
create function private.fee_allocations_reverse_only() returns trigger language plpgsql set search_path = '' as $$
begin
  if old.reversed_at is not null or new.reversed_at is null
    or (new.id, new.club_id, new.fee_id, new.receipt_id, new.amount_sen, new.source, new.created_by, new.created_at) is distinct from (old.id, old.club_id, old.fee_id, old.receipt_id, old.amount_sen, old.source, old.created_by, old.created_at)
    or new.method is distinct from old.method or new.reference is distinct from old.reference or new.notes is distinct from old.notes then
    raise exception 'Allocations can only be reversed once' using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger fee_allocations_reverse_only before update on public.fee_allocations for each row execute function private.fee_allocations_reverse_only();

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create function private.require_club_owner(p_club_id uuid) returns void language plpgsql stable set search_path = '' as $$
begin
  if not private.is_club_member(p_club_id, '{owner}') then
    raise exception 'Not authorized' using errcode = '42501';
  end if;
end;
$$;
revoke all on function private.require_club_owner(uuid) from public, anon;
grant execute on function private.require_club_owner(uuid) to authenticated;

-- Finance income category for a fee type (values of the payments_received category check).
create function private.fee_income_category(p_fee_type text) returns text language sql immutable set search_path = '' as $$
  select case p_fee_type
    when 'monthly' then 'monthly_fees'
    when 'registration' then 'registration_fees'
    when 'grading' then 'grading_fees'
    when 'uniform' then 'merchandise'
    when 'event' then 'events'
    else 'other_income'
  end;
$$;
revoke all on function private.fee_income_category(text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Writes (SECURITY DEFINER, owner check first)
-- ---------------------------------------------------------------------------

-- One charge. p_id is the client's idempotency key: an identical retry returns it; any other reuse
-- fails. A second standard monthly fee for the same student and month fails.
create function public.create_student_fee(p_id uuid, p_club_id uuid, p_student_id uuid, p_branch_id uuid, p_fee_type text, p_title text, p_billing_month date, p_due_date date, p_amount_sen integer, p_notes text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  existing public.student_fees;
begin
  perform private.require_club_owner(p_club_id);
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_id::text, 0));
  select * into existing from public.student_fees where id = p_id;
  if found then
    if existing.club_id = p_club_id and existing.created_by = auth.uid() and existing.student_id = p_student_id
      and existing.branch_id is not distinct from p_branch_id and existing.fee_type = p_fee_type and existing.title = pg_catalog.btrim(p_title)
      and existing.billing_month = p_billing_month and existing.due_date = p_due_date and existing.amount_sen = p_amount_sen
      and existing.notes is not distinct from nullif(pg_catalog.btrim(p_notes), '') then
      return p_id;
    end if;
    raise exception 'Submission already used' using errcode = '23505';
  end if;
  begin
    insert into public.student_fees (id, club_id, student_id, branch_id, fee_type, title, billing_month, due_date, amount_sen, notes)
    values (p_id, p_club_id, p_student_id, p_branch_id, p_fee_type, pg_catalog.btrim(p_title), p_billing_month, p_due_date, p_amount_sen, nullif(pg_catalog.btrim(p_notes), ''));
  exception when unique_violation then
    raise exception 'Monthly fee already exists for this student and month' using errcode = '23505';
  end;
  insert into public.fee_audit_events (club_id, fee_id, action, details)
  values (p_club_id, p_id, 'created', pg_catalog.jsonb_build_object('amount_sen', p_amount_sen, 'fee_type', p_fee_type, 'billing_month', p_billing_month, 'branch_id', p_branch_id));
  return p_id;
end;
$$;
revoke all on function public.create_student_fee(uuid, uuid, uuid, uuid, text, text, date, date, integer, text) from public, anon;
grant execute on function public.create_student_fee(uuid, uuid, uuid, uuid, text, text, date, date, integer, text) to authenticated;

-- Manual monthly generation from a reviewed list: p_items = [{"student_id": uuid, "amount_sen": int}].
-- Each student's current branch is captured. Students already charged for the month are skipped
-- (also on retries and concurrent runs); students no longer active or on an archived branch are
-- reported as ineligible. Nothing else is charged.
create function public.generate_monthly_fees(p_club_id uuid, p_billing_month date, p_due_date date, p_title text, p_items jsonb)
returns table(result_student_id uuid, result_fee_id uuid, outcome text)
language plpgsql security definer set search_path = '' as $$
declare
  item jsonb;
  sid uuid;
  amount integer;
  new_id uuid;
  st record;
begin
  perform private.require_club_owner(p_club_id);
  if p_items is null or pg_catalog.jsonb_typeof(p_items) <> 'array' or pg_catalog.jsonb_array_length(p_items) not between 1 and 500 then
    raise exception 'Choose between 1 and 500 students' using errcode = '22023';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('fees:' || p_club_id::text || ':' || p_billing_month::text, 0));
  for item in select value from pg_catalog.jsonb_array_elements(p_items) loop
    sid := (item ->> 'student_id')::uuid;
    amount := (item ->> 'amount_sen')::integer;
    select s.branch_id, s.status, s.archived_at, b.archived_at as branch_archived_at into st
      from public.students s left join public.branches b on b.club_id = s.club_id and b.id = s.branch_id
      where s.club_id = p_club_id and s.id = sid;
    if not found then
      raise exception 'Student not found' using errcode = '23503';
    end if;
    result_student_id := sid;
    if st.archived_at is not null or st.status <> 'active' or st.branch_archived_at is not null then
      result_fee_id := null; outcome := 'ineligible';
      return next;
      continue;
    end if;
    new_id := null;
    insert into public.student_fees (club_id, student_id, branch_id, fee_type, title, billing_month, due_date, amount_sen)
    values (p_club_id, sid, st.branch_id, 'monthly', pg_catalog.btrim(p_title), p_billing_month, p_due_date, amount)
    on conflict (club_id, student_id, billing_month) where fee_type = 'monthly' and voided_at is null do nothing
    returning id into new_id;
    result_fee_id := new_id;
    if new_id is null then
      outcome := 'skipped';
    else
      outcome := 'created';
      insert into public.fee_audit_events (club_id, fee_id, action, details)
      values (p_club_id, new_id, 'created', pg_catalog.jsonb_build_object('amount_sen', amount, 'fee_type', 'monthly', 'billing_month', p_billing_month, 'branch_id', st.branch_id, 'generated', true));
    end if;
    return next;
  end loop;
end;
$$;
revoke all on function public.generate_monthly_fees(uuid, date, date, text, jsonb) from public, anon;
grant execute on function public.generate_monthly_fees(uuid, date, date, text, jsonb) to authenticated;

-- Edit a fee. With unreversed payments only the title, due date and notes may change (the
-- student_fees_guard trigger enforces it too). The previous and new values are audited.
create function public.update_student_fee(p_club_id uuid, p_fee_id uuid, p_branch_id uuid, p_fee_type text, p_title text, p_billing_month date, p_due_date date, p_amount_sen integer, p_notes text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare
  f public.student_fees;
begin
  perform private.require_club_owner(p_club_id);
  select * into f from public.student_fees where club_id = p_club_id and id = p_fee_id for update;
  if not found then raise exception 'Fee not found' using errcode = 'P0002'; end if;
  begin
    update public.student_fees set branch_id = p_branch_id, fee_type = p_fee_type, title = pg_catalog.btrim(p_title), billing_month = p_billing_month,
      due_date = p_due_date, amount_sen = p_amount_sen, notes = nullif(pg_catalog.btrim(p_notes), ''), updated_at = pg_catalog.now(), updated_by = auth.uid()
    where club_id = p_club_id and id = p_fee_id;
  exception when unique_violation then
    raise exception 'Monthly fee already exists for this student and month' using errcode = '23505';
  end;
  insert into public.fee_audit_events (club_id, fee_id, action, details)
  values (p_club_id, p_fee_id, 'updated', pg_catalog.jsonb_build_object(
    'before', pg_catalog.jsonb_build_object('branch_id', f.branch_id, 'fee_type', f.fee_type, 'title', f.title, 'billing_month', f.billing_month, 'due_date', f.due_date, 'amount_sen', f.amount_sen, 'notes', f.notes),
    'after', pg_catalog.jsonb_build_object('branch_id', p_branch_id, 'fee_type', p_fee_type, 'title', pg_catalog.btrim(p_title), 'billing_month', p_billing_month, 'due_date', p_due_date, 'amount_sen', p_amount_sen, 'notes', nullif(pg_catalog.btrim(p_notes), ''))));
end;
$$;
revoke all on function public.update_student_fee(uuid, uuid, uuid, text, text, date, date, integer, text) from public, anon;
grant execute on function public.update_student_fee(uuid, uuid, uuid, text, text, date, date, integer, text) to authenticated;

-- Void an unpaid fee (blocked while unreversed payments exist). Repeating it is a no-op.
create function public.void_student_fee(p_club_id uuid, p_fee_id uuid, p_reason text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  f public.student_fees;
begin
  perform private.require_club_owner(p_club_id);
  select * into f from public.student_fees where club_id = p_club_id and id = p_fee_id for update;
  if not found then raise exception 'Fee not found' using errcode = 'P0002'; end if;
  if f.voided_at is not null then return; end if;
  update public.student_fees set voided_at = pg_catalog.now(), voided_by = auth.uid(), void_reason = pg_catalog.btrim(p_reason) where club_id = p_club_id and id = p_fee_id;
  insert into public.fee_audit_events (club_id, fee_id, action, details) values (p_club_id, p_fee_id, 'voided', pg_catalog.jsonb_build_object('reason', pg_catalog.btrim(p_reason)));
end;
$$;
revoke all on function public.void_student_fee(uuid, uuid, text) from public, anon;
grant execute on function public.void_student_fee(uuid, uuid, text) to authenticated;

-- Record a payment against a fee: in one transaction, create exactly one Finance receipt (category
-- from the fee type, the fee's recorded branch, the actual payment date) and its allocation.
-- p_id is the receipt id and idempotency key. Partial payments are allowed; more than the balance
-- is rejected (no credit is created).
create function public.record_fee_payment(p_id uuid, p_club_id uuid, p_fee_id uuid, p_amount_sen integer, p_paid_on date, p_method text, p_reference text default null, p_notes text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  f record;
  existing record;
begin
  perform private.require_club_owner(p_club_id);
  if p_method is null or p_method not in ('cash', 'bank_transfer', 'other') then
    raise exception 'Invalid payment method' using errcode = '22023';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_id::text, 0));
  select a.fee_id, a.amount_sen, a.method, a.created_by, r.occurred_on into existing
    from public.fee_allocations a join public.payments_received r on r.club_id = a.club_id and r.id = a.receipt_id
    where a.receipt_id = p_id and a.source = 'fee_payment';
  if found then
    if existing.fee_id = p_fee_id and existing.amount_sen = p_amount_sen and existing.occurred_on = p_paid_on and existing.method = p_method and existing.created_by = auth.uid() then
      return p_id;
    end if;
    raise exception 'Submission already used' using errcode = '23505';
  end if;
  if exists (select 1 from public.payments_received where id = p_id) or exists (select 1 from public.expenses where id = p_id) then
    raise exception 'Submission already used' using errcode = '23505';
  end if;
  select fe.id, fe.title, fe.fee_type, fe.branch_id, fe.voided_at, s.full_name into f
    from public.student_fees fe join public.students s on s.club_id = fe.club_id and s.id = fe.student_id
    where fe.club_id = p_club_id and fe.id = p_fee_id
    for update of fe;
  if not found then raise exception 'Fee not found' using errcode = 'P0002'; end if;
  if f.voided_at is not null then raise exception 'Fee is voided' using errcode = '23514'; end if;
  insert into public.payments_received (id, club_id, branch_id, amount_sen, occurred_on, description, created_by, category)
  values (p_id, p_club_id, f.branch_id, p_amount_sen, p_paid_on, pg_catalog.btrim(pg_catalog.left(f.title || ' · ' || f.full_name, 200)), auth.uid(), private.fee_income_category(f.fee_type));
  -- fee_allocations_guard rejects more than the remaining balance.
  insert into public.fee_allocations (club_id, fee_id, receipt_id, amount_sen, source, method, reference, notes)
  values (p_club_id, p_fee_id, p_id, p_amount_sen, 'fee_payment', p_method, nullif(pg_catalog.btrim(p_reference), ''), nullif(pg_catalog.btrim(p_notes), ''));
  insert into public.fee_audit_events (club_id, fee_id, action, details)
  values (p_club_id, p_fee_id, 'payment_recorded', pg_catalog.jsonb_build_object('receipt_id', p_id, 'amount_sen', p_amount_sen, 'paid_on', p_paid_on, 'method', p_method));
  return p_id;
end;
$$;
revoke all on function public.record_fee_payment(uuid, uuid, uuid, integer, date, text, text, text) from public, anon;
grant execute on function public.record_fee_payment(uuid, uuid, uuid, integer, date, text, text, text) to authenticated;

-- Link part of an existing Finance receipt to a fee (no new income). p_id is the allocation id
-- and idempotency key. Limited by the receipt's unallocated amount and the fee's balance (trigger).
-- A branch difference is allowed and recorded; neither record's branch is changed.
create function public.link_fee_receipt(p_id uuid, p_club_id uuid, p_fee_id uuid, p_receipt_id uuid, p_amount_sen integer)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  existing public.fee_allocations;
  fee_branch uuid;
  receipt_branch uuid;
begin
  perform private.require_club_owner(p_club_id);
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_id::text, 0));
  select * into existing from public.fee_allocations where id = p_id;
  if found then
    if existing.club_id = p_club_id and existing.fee_id = p_fee_id and existing.receipt_id = p_receipt_id and existing.amount_sen = p_amount_sen and existing.created_by = auth.uid() then
      return p_id;
    end if;
    raise exception 'Submission already used' using errcode = '23505';
  end if;
  select fe.branch_id into fee_branch from public.student_fees fe where fe.club_id = p_club_id and fe.id = p_fee_id for update;
  if not found then raise exception 'Fee not found' using errcode = 'P0002'; end if;
  select r.branch_id into receipt_branch from public.payments_received r where r.club_id = p_club_id and r.id = p_receipt_id;
  if not found then raise exception 'Receipt not found' using errcode = '23503'; end if;
  insert into public.fee_allocations (id, club_id, fee_id, receipt_id, amount_sen, source)
  values (p_id, p_club_id, p_fee_id, p_receipt_id, p_amount_sen, 'linked_receipt');
  insert into public.fee_audit_events (club_id, fee_id, allocation_id, action, details)
  values (p_club_id, p_fee_id, p_id, 'receipt_linked', pg_catalog.jsonb_build_object('receipt_id', p_receipt_id, 'amount_sen', p_amount_sen, 'branch_mismatch', fee_branch is distinct from receipt_branch));
  return p_id;
end;
$$;
revoke all on function public.link_fee_receipt(uuid, uuid, uuid, uuid, integer) from public, anon;
grant execute on function public.link_fee_receipt(uuid, uuid, uuid, uuid, integer) to authenticated;

-- Remove an allocation (e.g. linked to the wrong fee): reopens the fee balance and frees the
-- receipt amount. The Finance receipt is kept; this is not a refund. Repeating it is a no-op.
create function public.reverse_fee_allocation(p_club_id uuid, p_allocation_id uuid, p_reason text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  a public.fee_allocations;
begin
  perform private.require_club_owner(p_club_id);
  select * into a from public.fee_allocations where club_id = p_club_id and id = p_allocation_id;
  if not found then raise exception 'Allocation not found' using errcode = 'P0002'; end if;
  -- Same lock order as payments (fee first) so a reversal and a payment serialize.
  perform 1 from public.student_fees where club_id = p_club_id and id = a.fee_id for update;
  update public.fee_allocations set reversed_at = pg_catalog.now(), reversed_by = auth.uid(), reversal_reason = pg_catalog.btrim(p_reason)
    where club_id = p_club_id and id = p_allocation_id and reversed_at is null;
  if not found then return; end if;
  insert into public.fee_audit_events (club_id, fee_id, allocation_id, action, details)
  values (p_club_id, a.fee_id, p_allocation_id, 'allocation_reversed', pg_catalog.jsonb_build_object('receipt_id', a.receipt_id, 'amount_sen', a.amount_sen, 'reason', pg_catalog.btrim(p_reason)));
end;
$$;
revoke all on function public.reverse_fee_allocation(uuid, uuid, text) from public, anon;
grant execute on function public.reverse_fee_allocation(uuid, uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Reads (SECURITY INVOKER: owner-only RLS applies)
-- ---------------------------------------------------------------------------

-- Fees with paid (unreversed allocations), balance and status. Status filters: NULL (all
-- non-voided), unpaid (nothing paid), partial, paid, overdue (balance left and due before today in
-- Malaysia; due today is not overdue), voided (voided only). p_month NULL = every billing month;
-- p_outstanding keeps fees with a balance. p_search: case-insensitive part of the student's name.
create function public.fee_list(p_club_id uuid, p_month date default null, p_branch_id uuid default null, p_status text default null, p_search text default null, p_outstanding boolean default false)
returns table(id uuid, student_id uuid, student_name text, student_archived boolean, branch_id uuid, fee_type text, title text, billing_month date, due_date date, amount_sen integer, paid_sen bigint, balance_sen bigint, status text, overdue boolean, notes text, created_at timestamptz, voided_at timestamptz, void_reason text)
language plpgsql stable security invoker set search_path = '' as $$
declare
  today date := (pg_catalog.now() at time zone 'Asia/Kuala_Lumpur')::date;
begin
  perform private.require_club_owner(p_club_id);
  if p_branch_id is not null and not exists (select 1 from public.branches b where b.id = p_branch_id and b.club_id = p_club_id) then
    raise exception 'Invalid branch' using errcode = '42501';
  end if;
  if p_status is not null and p_status not in ('unpaid', 'partial', 'paid', 'overdue', 'voided') then
    raise exception 'Invalid status' using errcode = '22023';
  end if;
  return query
    select x.id, x.student_id, x.student_name, x.student_archived, x.branch_id, x.fee_type, x.title, x.billing_month, x.due_date, x.amount_sen,
      x.paid, x.amount_sen - x.paid,
      case when x.voided_at is not null then 'voided' when x.paid >= x.amount_sen then 'paid' when x.paid > 0 then 'partial' else 'unpaid' end,
      x.voided_at is null and x.paid < x.amount_sen and x.due_date < today,
      x.notes, x.created_at, x.voided_at, x.void_reason
    from (
      select f.id, f.student_id, s.full_name as student_name, s.archived_at is not null as student_archived, f.branch_id, f.fee_type, f.title,
        f.billing_month, f.due_date, f.amount_sen, f.notes, f.created_at, f.voided_at, f.void_reason,
        coalesce((select sum(a.amount_sen) from public.fee_allocations a where a.club_id = f.club_id and a.fee_id = f.id and a.reversed_at is null), 0)::bigint as paid
      from public.student_fees f
      join public.students s on s.club_id = f.club_id and s.id = f.student_id
      where f.club_id = p_club_id
        and (p_month is null or f.billing_month = p_month)
        and (p_branch_id is null or f.branch_id = p_branch_id)
        and (p_search is null or pg_catalog.strpos(pg_catalog.lower(s.full_name), pg_catalog.lower(p_search)) > 0)
    ) x
    where (case when p_status = 'voided' then x.voided_at is not null else x.voided_at is null end)
      and (not coalesce(p_outstanding, false) or x.paid < x.amount_sen)
      and (p_status is null or p_status = 'voided'
        or (p_status = 'unpaid' and x.paid = 0)
        or (p_status = 'partial' and x.paid > 0 and x.paid < x.amount_sen)
        or (p_status = 'paid' and x.paid >= x.amount_sen)
        or (p_status = 'overdue' and x.paid < x.amount_sen and x.due_date < today));
end;
$$;
revoke all on function public.fee_list(uuid, date, uuid, text, text, boolean) from public, anon;
grant execute on function public.fee_list(uuid, date, uuid, text, text, boolean) to authenticated;

-- Totals for the non-voided fees in scope (billing month or all outstanding, plus branch): charged,
-- collected (allocated), outstanding and overdue (a subset of outstanding). Sums as text, in sen.
create function public.fee_summary(p_club_id uuid, p_month date default null, p_branch_id uuid default null, p_outstanding boolean default false)
returns table(fee_count bigint, charged_sen text, collected_sen text, outstanding_sen text, overdue_sen text)
language sql stable security invoker set search_path = '' as $$
  select pg_catalog.count(*),
    coalesce(sum(l.amount_sen), 0)::text,
    coalesce(sum(l.paid_sen), 0)::text,
    coalesce(sum(l.balance_sen), 0)::text,
    coalesce(sum(l.balance_sen) filter (where l.overdue), 0)::text
  from public.fee_list(p_club_id, p_month, p_branch_id, null, null, p_outstanding) l;
$$;
revoke all on function public.fee_summary(uuid, date, uuid, boolean) from public, anon;
grant execute on function public.fee_summary(uuid, date, uuid, boolean) to authenticated;

-- Finance receipts of the club with an unallocated amount, newest first (at most 50).
create function public.fee_linkable_receipts(p_club_id uuid, p_search text default null)
returns table(id uuid, occurred_on date, description text, category text, branch_id uuid, amount_sen integer, allocated_sen bigint, available_sen bigint)
language plpgsql stable security invoker set search_path = '' as $$
begin
  perform private.require_club_owner(p_club_id);
  return query
    select r.id, r.occurred_on, r.description, r.category, r.branch_id, r.amount_sen, x.allocated, r.amount_sen - x.allocated
    from public.payments_received r
    cross join lateral (
      select coalesce(sum(a.amount_sen), 0)::bigint as allocated from public.fee_allocations a where a.club_id = r.club_id and a.receipt_id = r.id and a.reversed_at is null
    ) x
    where r.club_id = p_club_id and x.allocated < r.amount_sen
      and (p_search is null or pg_catalog.strpos(pg_catalog.lower(r.description), pg_catalog.lower(p_search)) > 0)
    order by r.occurred_on desc, r.created_at desc, r.id
    limit 50;
end;
$$;
revoke all on function public.fee_linkable_receipts(uuid, text) from public, anon;
grant execute on function public.fee_linkable_receipts(uuid, text) to authenticated;
