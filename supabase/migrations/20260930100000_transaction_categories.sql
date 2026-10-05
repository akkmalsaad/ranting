-- Categories for manual income (payments_received) and expense records.
--
-- Additive for data: a nullable `category` column on both tables. Existing records keep NULL and
-- are shown as "Uncategorised"; nothing is guessed or overwritten. New records require a category,
-- enforced by record_manual_transaction (the only insert path; tables have no insert grants).
-- The two finance functions are replaced (drop + create) because their signatures change; no data
-- is touched. RLS policies and grants on the tables are unchanged.
--
-- Recovery: roll the app back first. Restoring the previous function definitions from
-- 20260928140000_manual_finances.sql is safe; keep the column and its values.

alter table public.payments_received
  add column category text check (category in (
    'monthly_fees', 'registration_fees', 'grading_fees', 'events', 'merchandise', 'donations', 'other_income'
  ));

alter table public.expenses
  add column category text check (category in (
    'rent', 'staff_payments', 'equipment', 'utilities', 'events', 'marketing', 'administration', 'other_expenses'
  ));

create index payments_received_category_idx on public.payments_received(club_id, category, occurred_on);
create index expenses_category_idx on public.expenses(club_id, category, occurred_on);

-- ---------------------------------------------------------------------------
-- record_manual_transaction: same checks and idempotency as before, plus a required category.
-- ---------------------------------------------------------------------------

drop function public.record_manual_transaction(uuid, uuid, text, uuid, integer, date, text);

create function public.record_manual_transaction(p_id uuid, p_club_id uuid, p_kind text, p_branch_id uuid, p_amount_sen integer, p_occurred_on date, p_description text, p_category text)
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
revoke all on function public.record_manual_transaction(uuid, uuid, text, uuid, integer, date, text, text) from public, anon;
grant execute on function public.record_manual_transaction(uuid, uuid, text, uuid, integer, date, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- finance_totals: optional category filter. NULL = all categories;
-- 'uncategorised' = records without a category (historical records).
-- ---------------------------------------------------------------------------

drop function public.finance_totals(uuid, date, date, uuid);

create function public.finance_totals(p_club_id uuid, p_start date, p_end date, p_branch_id uuid default null, p_category text default null)
returns table(income_sen text, expense_sen text)
language plpgsql stable security invoker set search_path = '' as $$
begin
  if not private.is_club_member(p_club_id, '{owner}') then
    raise exception 'Not authorized' using errcode = '42501';
  end if;
  if p_start is null or p_end is null or p_end <= p_start then
    raise exception 'Invalid date range' using errcode = '22023';
  end if;
  if p_branch_id is not null and not exists (select 1 from public.branches where id = p_branch_id and club_id = p_club_id) then
    raise exception 'Invalid branch' using errcode = '42501';
  end if;
  return query select
    (select coalesce(sum(amount_sen), 0)::text from public.payments_received where club_id = p_club_id and occurred_on >= p_start and occurred_on < p_end and (p_branch_id is null or branch_id = p_branch_id)
      and (p_category is null or (p_category = 'uncategorised' and category is null) or category = p_category)),
    (select coalesce(sum(amount_sen), 0)::text from public.expenses where club_id = p_club_id and occurred_on >= p_start and occurred_on < p_end and (p_branch_id is null or branch_id = p_branch_id)
      and (p_category is null or (p_category = 'uncategorised' and category is null) or category = p_category));
end;
$$;
revoke all on function public.finance_totals(uuid, date, date, uuid, text) from public, anon;
grant execute on function public.finance_totals(uuid, date, date, uuid, text) to authenticated;
