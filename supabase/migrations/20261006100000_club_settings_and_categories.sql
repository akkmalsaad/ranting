-- Settings: fee defaults, accepted payment methods and club finance categories.
--
-- NOT APPLIED. Apply only with explicit authorisation (dry run should list only this file), then
-- regenerate types. Until then the app falls back to the previous fixed behaviour.
--
-- 1. Club defaults live on public.clubs (like the club profile), updated by owners through the
--    existing clubs_update policy and new column grants:
--    * default_monthly_fee_sen / fee_due_day: only prefill Generate monthly fees. Existing fees are
--      never changed by them.
--    * payment_methods: methods offered in Record payment (NULL = all). Historical allocations keep
--      whatever method they were recorded with.
-- 2. DuitNow QR becomes a valid payment method (fee_allocations check + record_fee_payment).
--    record_fee_payment is unchanged apart from the accepted method list.
-- 3. transaction_categories: per-club category list. Built-in keys can be renamed or archived by
--    an override row with the same key; custom categories use keys "custom_<12 chars>". Nothing is
--    deleted (no delete grant). Transactions keep storing the key, so renaming never rewrites
--    records. record_manual_transaction now rejects archived and unknown custom categories; its
--    other checks and idempotency are unchanged. Fee payments keep their built-in mapped category.
--
-- Additive for data: no existing row is modified. RLS: the new table is owner-only (select, insert,
-- update of label/archived_at), matching the club's other owner-managed lists.
--
-- Recovery: roll the app back first. The new columns and table can stay. To fully revert, restore
-- the previous check constraints and function bodies from 20260930100000_transaction_categories.sql
-- and 20261005100000_student_fees.sql, but only if no record uses 'duitnow_qr' or a custom key.

-- ---------------------------------------------------------------------------
-- 1. Club defaults
-- ---------------------------------------------------------------------------

alter table public.clubs
  add column default_monthly_fee_sen integer check (default_monthly_fee_sen is null or default_monthly_fee_sen between 1 and 999999999),
  add column fee_due_day smallint check (fee_due_day is null or fee_due_day between 1 and 31),
  add column payment_methods text[] check (
    payment_methods is null
    or (pg_catalog.cardinality(payment_methods) between 1 and 4
      and payment_methods <@ array['cash', 'bank_transfer', 'duitnow_qr', 'other']::text[])
  );

grant update (default_monthly_fee_sen, fee_due_day, payment_methods) on public.clubs to authenticated;

-- ---------------------------------------------------------------------------
-- 2. DuitNow QR payment method
-- ---------------------------------------------------------------------------

alter table public.fee_allocations drop constraint fee_allocations_method_check;
alter table public.fee_allocations add constraint fee_allocations_method_check
  check (method in ('cash', 'bank_transfer', 'duitnow_qr', 'other'));

create or replace function public.record_fee_payment(p_id uuid, p_club_id uuid, p_fee_id uuid, p_amount_sen integer, p_paid_on date, p_method text, p_reference text default null, p_notes text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  f record;
  existing record;
begin
  perform private.require_club_owner(p_club_id);
  if p_method is null or p_method not in ('cash', 'bank_transfer', 'duitnow_qr', 'other') then
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

-- ---------------------------------------------------------------------------
-- 3. Club finance categories
-- ---------------------------------------------------------------------------

create table public.transaction_categories (
  club_id uuid not null references public.clubs(id) on delete cascade,
  kind text not null check (kind in ('income', 'expense')),
  key text not null,
  label text not null check (pg_catalog.char_length(pg_catalog.btrim(label)) between 1 and 60),
  archived_at timestamptz,
  created_at timestamptz not null default pg_catalog.now(),
  created_by uuid default auth.uid(),
  primary key (club_id, kind, key),
  constraint transaction_categories_key_check check (
    key ~ '^custom_[a-z0-9]{12}$'
    or (kind = 'income' and key in ('monthly_fees', 'registration_fees', 'grading_fees', 'events', 'merchandise', 'donations', 'other_income'))
    or (kind = 'expense' and key in ('rent', 'staff_payments', 'equipment', 'utilities', 'events', 'marketing', 'administration', 'other_expenses'))
  )
);

alter table public.transaction_categories enable row level security;
grant select on public.transaction_categories to authenticated;
grant insert (club_id, kind, key, label, archived_at) on public.transaction_categories to authenticated;
grant update (label, archived_at) on public.transaction_categories to authenticated;

create policy transaction_categories_owner_select on public.transaction_categories for select to authenticated
  using (private.is_club_member(club_id, '{owner}'));
create policy transaction_categories_owner_insert on public.transaction_categories for insert to authenticated
  with check (private.is_club_member(club_id, '{owner}'));
create policy transaction_categories_owner_update on public.transaction_categories for update to authenticated
  using (private.is_club_member(club_id, '{owner}')) with check (private.is_club_member(club_id, '{owner}'));

-- Records may now also use a custom key; the key's club and state are checked on insert by
-- record_manual_transaction (the only insert path for manual records).
alter table public.payments_received drop constraint payments_received_category_check;
alter table public.payments_received add constraint payments_received_category_check check (
  category ~ '^custom_[a-z0-9]{12}$'
  or category in ('monthly_fees', 'registration_fees', 'grading_fees', 'events', 'merchandise', 'donations', 'other_income')
);
alter table public.expenses drop constraint expenses_category_check;
alter table public.expenses add constraint expenses_category_check check (
  category ~ '^custom_[a-z0-9]{12}$'
  or category in ('rent', 'staff_payments', 'equipment', 'utilities', 'events', 'marketing', 'administration', 'other_expenses')
);

create or replace function public.record_manual_transaction(p_id uuid, p_club_id uuid, p_kind text, p_branch_id uuid, p_amount_sen integer, p_occurred_on date, p_description text, p_category text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  existing record;
  target text;
begin
  if not private.is_club_member(p_club_id, '{owner}') then
    raise exception 'Not authorized' using errcode = '42501';
  end if;
  if p_kind is null or p_kind not in ('income', 'expense') then
    raise exception 'Invalid transaction kind' using errcode = '22023';
  end if;
  if p_category is null then
    raise exception 'Choose a category' using errcode = '23514';
  end if;
  target := case when p_kind = 'income' then 'payments_received' else 'expenses' end;
  -- Serialize reuse of an id, including retries across different kinds.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_id::text, 0));
  select * into existing from (
    select *, 'income'::text as kind from public.payments_received where id = p_id
    union all
    select *, 'expense'::text as kind from public.expenses where id = p_id
  ) records limit 1;
  if found then
    if existing.club_id = p_club_id and existing.created_by = auth.uid() and existing.kind = p_kind
      and existing.branch_id is not distinct from p_branch_id and existing.amount_sen = p_amount_sen
      and existing.occurred_on = p_occurred_on and existing.description = btrim(p_description)
      and existing.category is not distinct from p_category then
      return p_id;
    end if;
    raise exception 'Submission already used' using errcode = '23505';
  end if;
  -- New records: a custom category must be this club's, of this kind and not archived; a built-in
  -- one must not be archived by the club.
  if p_category ~ '^custom_' then
    perform 1 from public.transaction_categories c
      where c.club_id = p_club_id and c.kind = p_kind and c.key = p_category and c.archived_at is null;
    if not found then
      raise exception 'Choose a category' using errcode = '23514';
    end if;
  elsif exists (select 1 from public.transaction_categories c
      where c.club_id = p_club_id and c.kind = p_kind and c.key = p_category and c.archived_at is not null) then
    raise exception 'Choose a category' using errcode = '23514';
  end if;
  if p_branch_id is not null then
    perform 1 from public.branches where id = p_branch_id and club_id = p_club_id and archived_at is null for share;
    if not found then
      raise exception 'Choose a current branch of this club' using errcode = '23514';
    end if;
  end if;
  -- The table's check constraint rejects a category that doesn't belong to this kind.
  execute pg_catalog.format('insert into public.%I (id, club_id, branch_id, amount_sen, occurred_on, description, created_by, category) values ($1,$2,$3,$4,$5,$6,$7,$8)', target)
    using p_id, p_club_id, p_branch_id, p_amount_sen, p_occurred_on, btrim(p_description), auth.uid(), p_category;
  return p_id;
end;
$$;
