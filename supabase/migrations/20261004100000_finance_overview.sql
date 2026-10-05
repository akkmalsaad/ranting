-- Finance overview: read-only functions for the redesigned Finance page.
--
-- Additive only: new functions, no table, column, policy or grant changes, and no data touched.
-- finance_totals (used by the dashboard) is unchanged.
--
-- Every function is SECURITY INVOKER, so the existing owner-only SELECT policies on
-- payments_received / expenses still apply, and each re-checks owner membership, the date range
-- and the branch exactly as finance_totals does. Dates are Malaysia calendar dates and ranges are
-- half-open [p_start, p_end), the same contract as finance_totals.
--
-- All aggregates are computed from public.finance_transactions (one filtered union of both tables),
-- so category, branch, monthly and list subtotals reconcile with each other and with finance_totals
-- for the same club, dates and branch.
--
-- Recovery: roll the app back first, then drop these functions (no data depends on them):
--   drop function public.finance_monthly_totals(uuid, date, date, uuid);
--   drop function public.finance_branch_totals(uuid, date, date);
--   drop function public.finance_category_totals(uuid, date, date, uuid);
--   drop function public.finance_transaction_totals(uuid, date, date, uuid, text, text, text);
--   drop function public.finance_transactions(uuid, date, date, uuid, text, text, text);
--   drop function private.assert_finance_scope(uuid, date, date, uuid);

-- ---------------------------------------------------------------------------
-- Shared checks (same errors as finance_totals).
-- ---------------------------------------------------------------------------

create function private.assert_finance_scope(p_club_id uuid, p_start date, p_end date, p_branch_id uuid)
returns void language plpgsql stable security invoker set search_path = '' as $$
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
end;
$$;
revoke all on function private.assert_finance_scope(uuid, date, date, uuid) from public, anon;
grant execute on function private.assert_finance_scope(uuid, date, date, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- finance_transactions: income and expense records as one list.
--   p_kind: NULL (both) | 'income' | 'expense'
--   p_category: NULL (all) | 'uncategorised' (no category) | a category value
--   p_search: NULL or a case-insensitive substring of the description (no LIKE wildcards)
-- Callers order and paginate (e.g. occurred_on desc, created_at desc, id). Record ids are unique
-- across both tables (record_manual_transaction checks both).
-- ---------------------------------------------------------------------------

create function public.finance_transactions(p_club_id uuid, p_start date, p_end date, p_branch_id uuid default null, p_kind text default null, p_category text default null, p_search text default null)
returns table(id uuid, kind text, description text, category text, branch_id uuid, occurred_on date, amount_sen integer, created_at timestamptz)
language plpgsql stable security invoker set search_path = '' as $$
begin
  perform private.assert_finance_scope(p_club_id, p_start, p_end, p_branch_id);
  if p_kind is not null and p_kind not in ('income', 'expense') then
    raise exception 'Invalid transaction kind' using errcode = '22023';
  end if;
  return query
    select t.id, t.kind, t.description, t.category, t.branch_id, t.occurred_on, t.amount_sen, t.created_at
    from (
      select r.id, 'income'::text as kind, r.description, r.category, r.branch_id, r.occurred_on, r.amount_sen, r.created_at
        from public.payments_received r
        where (p_kind is null or p_kind = 'income') and r.club_id = p_club_id and r.occurred_on >= p_start and r.occurred_on < p_end
      union all
      select e.id, 'expense'::text, e.description, e.category, e.branch_id, e.occurred_on, e.amount_sen, e.created_at
        from public.expenses e
        where (p_kind is null or p_kind = 'expense') and e.club_id = p_club_id and e.occurred_on >= p_start and e.occurred_on < p_end
    ) t
    where (p_branch_id is null or t.branch_id = p_branch_id)
      and (p_category is null or (p_category = 'uncategorised' and t.category is null) or t.category = p_category)
      and (p_search is null or pg_catalog.strpos(pg_catalog.lower(t.description), pg_catalog.lower(p_search)) > 0);
end;
$$;
revoke all on function public.finance_transactions(uuid, date, date, uuid, text, text, text) from public, anon;
grant execute on function public.finance_transactions(uuid, date, date, uuid, text, text, text) to authenticated;

-- Count and subtotals for exactly the rows finance_transactions returns (sums as text, in sen).
create function public.finance_transaction_totals(p_club_id uuid, p_start date, p_end date, p_branch_id uuid default null, p_kind text default null, p_category text default null, p_search text default null)
returns table(record_count bigint, income_sen text, expense_sen text)
language sql stable security invoker set search_path = '' as $$
  select pg_catalog.count(*),
    coalesce(sum(t.amount_sen) filter (where t.kind = 'income'), 0)::text,
    coalesce(sum(t.amount_sen) filter (where t.kind = 'expense'), 0)::text
  from public.finance_transactions(p_club_id, p_start, p_end, p_branch_id, p_kind, p_category, p_search) t;
$$;
revoke all on function public.finance_transaction_totals(uuid, date, date, uuid, text, text, text) from public, anon;
grant execute on function public.finance_transaction_totals(uuid, date, date, uuid, text, text, text) to authenticated;

-- Totals per kind and category (category NULL = uncategorised historical records).
create function public.finance_category_totals(p_club_id uuid, p_start date, p_end date, p_branch_id uuid default null)
returns table(kind text, category text, total_sen text, record_count bigint)
language sql stable security invoker set search_path = '' as $$
  select t.kind, t.category, sum(t.amount_sen)::text, pg_catalog.count(*)
  from public.finance_transactions(p_club_id, p_start, p_end, p_branch_id) t
  group by t.kind, t.category;
$$;
revoke all on function public.finance_category_totals(uuid, date, date, uuid) from public, anon;
grant execute on function public.finance_category_totals(uuid, date, date, uuid) to authenticated;

-- Totals per branch for the whole club (branch_id NULL = club-level records). Archived branches
-- keep their historical rows.
create function public.finance_branch_totals(p_club_id uuid, p_start date, p_end date)
returns table(branch_id uuid, income_sen text, expense_sen text)
language sql stable security invoker set search_path = '' as $$
  select t.branch_id,
    coalesce(sum(t.amount_sen) filter (where t.kind = 'income'), 0)::text,
    coalesce(sum(t.amount_sen) filter (where t.kind = 'expense'), 0)::text
  from public.finance_transactions(p_club_id, p_start, p_end) t
  group by t.branch_id;
$$;
revoke all on function public.finance_branch_totals(uuid, date, date) from public, anon;
grant execute on function public.finance_branch_totals(uuid, date, date) to authenticated;

-- Totals per calendar month ('YYYY-MM'); months without records are omitted (the app fills zeros).
create function public.finance_monthly_totals(p_club_id uuid, p_start date, p_end date, p_branch_id uuid default null)
returns table(month text, income_sen text, expense_sen text)
language sql stable security invoker set search_path = '' as $$
  select pg_catalog.to_char(t.occurred_on, 'YYYY-MM'),
    coalesce(sum(t.amount_sen) filter (where t.kind = 'income'), 0)::text,
    coalesce(sum(t.amount_sen) filter (where t.kind = 'expense'), 0)::text
  from public.finance_transactions(p_club_id, p_start, p_end, p_branch_id) t
  group by 1
  order by 1;
$$;
revoke all on function public.finance_monthly_totals(uuid, date, date, uuid) from public, anon;
grant execute on function public.finance_monthly_totals(uuid, date, date, uuid) to authenticated;
