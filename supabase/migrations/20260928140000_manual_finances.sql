-- Manual cash records, not invoices, fee allocations or gateway events.
-- Calendar dates explicitly mean Asia/Kuala_Lumpur. Creation timestamps are UTC instants.
-- No backfill: existing clubs start with no recorded transactions.
-- Recovery: roll app back first; retain tables/history. Never drop financial records to roll back.
-- Only apply remotely after target confirmation and explicit approval.

create table public.payments_received (
  id uuid primary key,
  club_id uuid not null references public.clubs(id) on delete restrict,
  branch_id uuid,
  amount_sen integer not null check (amount_sen between 1 and 999999999),
  currency text not null default 'MYR' check (currency = 'MYR'),
  occurred_on date not null check (occurred_on >= date '1900-01-01' and occurred_on <= (now() at time zone 'Asia/Kuala_Lumpur')::date),
  description text not null check (description = btrim(description) and char_length(description) between 2 and 200),
  created_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  foreign key (club_id, branch_id) references public.branches(club_id, id) on delete restrict
);
create table public.expenses (
  like public.payments_received including defaults including constraints including indexes,
  foreign key (club_id) references public.clubs(id) on delete restrict,
  foreign key (created_by) references auth.users(id) on delete restrict,
  foreign key (club_id, branch_id) references public.branches(club_id, id) on delete restrict
);
create index payments_received_scope_date_idx on public.payments_received(club_id, occurred_on desc, id);
create index payments_received_branch_idx on public.payments_received(club_id, branch_id);
create index payments_received_actor_idx on public.payments_received(created_by);
create index expenses_scope_date_idx on public.expenses(club_id, occurred_on desc, id);
create index expenses_branch_idx on public.expenses(club_id, branch_id);
create index expenses_actor_idx on public.expenses(created_by);

alter table public.payments_received enable row level security;
alter table public.expenses enable row level security;
revoke all on public.payments_received, public.expenses from public, anon, authenticated;
grant select on public.payments_received, public.expenses to authenticated;
-- Inserts go through the narrow RPC below. No updates/deletes, preserving original history
-- and actor/time attribution. Corrections/refunds require a future reviewed workflow.
create policy payments_owner_read on public.payments_received for select to authenticated
  using (private.is_club_member(club_id, '{owner}'));
create policy expenses_owner_read on public.expenses for select to authenticated
  using (private.is_club_member(club_id, '{owner}'));

create function public.record_manual_transaction(p_id uuid, p_club_id uuid, p_kind text, p_branch_id uuid, p_amount_sen integer, p_occurred_on date, p_description text)
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
      and existing.occurred_on = p_occurred_on and existing.description = btrim(p_description) then
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
  execute pg_catalog.format('insert into public.%I (id, club_id, branch_id, amount_sen, occurred_on, description, created_by) values ($1,$2,$3,$4,$5,$6,$7)', target)
    using p_id, p_club_id, p_branch_id, p_amount_sen, p_occurred_on, btrim(p_description), auth.uid();
  return p_id;
end;
$$;
revoke all on function public.record_manual_transaction(uuid, uuid, text, uuid, integer, date, text) from public, anon;
grant execute on function public.record_manual_transaction(uuid, uuid, text, uuid, integer, date, text) to authenticated;

-- Invoker rights retain RLS. SQL aggregation avoids PostgREST row limits and JS rounding.
create function public.finance_totals(p_club_id uuid, p_start date, p_end date, p_branch_id uuid default null)
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
    (select coalesce(sum(amount_sen), 0)::text from public.payments_received where club_id = p_club_id and occurred_on >= p_start and occurred_on < p_end and (p_branch_id is null or branch_id = p_branch_id)),
    (select coalesce(sum(amount_sen), 0)::text from public.expenses where club_id = p_club_id and occurred_on >= p_start and occurred_on < p_end and (p_branch_id is null or branch_id = p_branch_id));
end;
$$;
revoke all on function public.finance_totals(uuid, date, date, uuid) from public, anon;
grant execute on function public.finance_totals(uuid, date, date, uuid) to authenticated;
