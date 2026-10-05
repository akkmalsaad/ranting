import Link from "next/link";
import { notFound } from "next/navigation";
import { assets } from "@/lib/assets";
import { clubClient, requireClub } from "@/lib/clubs";
import { branchScope, branchTotals, categoryTotals, financeTotals, listTransactions, monthlyTotals, type CategoryRow } from "@/lib/finance/queries";
import { categoryLabel, formatMYR, formatSignedMYR, daySchema } from "@/lib/finance/values";
import { financeHref, listFilters, monthName, monthsOf, resolvePeriod } from "@/lib/finance/view";
import { idSchema, pageNumber, todayInMalaysia } from "@/lib/validation";
import { PageHeader } from "@/components/page-header";
import { ViewTabs } from "@/components/view-tabs";
import { SuccessNote } from "@/components/notice";
import { EmptyState } from "@/components/empty-state";
import { Pagination } from "@/components/pagination";
import { buttonVariants } from "@/components/ui/button";
import { AddTransactionDialog } from "@/components/finance/transaction-form";
import { FinanceControls, TransactionFilters } from "@/components/finance/finance-controls";
import { CashFlowTable, CategoryBreakdown, SummaryCards, TransactionTable, type CashFlowRow } from "@/components/finance/overview";
import { loadClubCategories } from "@/lib/club-settings";
import { addTransaction } from "./actions";

export const metadata = { title: "Finance" };

const PAGE_SIZE = 25;
const ZERO = BigInt(0);

/**
 * Finance overview. Period (`period` | `month` | `date` | `from`+`to`) and `branch` scope the whole
 * page; `kind`, `category` and `q` filter only the transaction list and its subtotal. Every figure
 * is a database aggregate over all matching records, scoped by owner-only RLS and re-checked
 * membership.
 */
export default async function Finance({ params, searchParams }: PageProps<"/clubs/[clubId]/finances">) {
  const { clubId } = await params;
  const sp = await searchParams;
  const today = todayInMalaysia();
  const period = resolvePeriod(sp, today);
  const list = listFilters(sp);
  if (!period || !list) notFound();
  const branchId = typeof sp.branch === "string" ? sp.branch : "";
  if (branchId && !idSchema.safeParse(branchId).success) notFound();
  const page = pageNumber(sp.page);
  const range = { start: period.start, end: period.end };

  const { db } = await clubClient(clubId);
  const [{ club }, scope, totals, categories, branches, monthly, transactions, { categories: clubCategories }] = await Promise.all([
    requireClub(clubId),
    branchScope(clubId, branchId),
    financeTotals(clubId, branchId, range),
    categoryTotals(clubId, branchId, range),
    branchId ? null : branchTotals(clubId, range),
    period.kind === "ytd" ? monthlyTotals(clubId, branchId, range) : null,
    listTransactions(clubId, branchId, range, list, page, PAGE_SIZE),
    loadClubCategories(clubId),
  ]);
  // Breakdown rows show the club's own names (renamed or custom categories).
  const labelled = (kind: "income" | "expense", rows: CategoryRow[]) => rows.map((r) => ({ ...r, label: categoryLabel(kind, r.category, clubCategories) }));

  // Branch names, including archived branches with history; a club with more branches than the
  // bounded options list resolves the rest in one more query.
  const names = new Map(scope.options.map((b) => [b.id, `${b.name}${b.archived_at ? " (archived)" : ""}`]));
  const missing = [...new Set([...(branches?.ok ? branches.rows.map((r) => r.branchId) : []), ...(transactions.ok ? transactions.rows.map((t) => t.branch_id) : [])])].filter((id): id is string => !!id && !names.has(id));
  if (missing.length) {
    const { data } = await db.from("branches").select("id, name, archived_at").eq("club_id", club.id).in("id", missing);
    for (const b of data ?? []) names.set(b.id, `${b.name}${b.archived_at ? " (archived)" : ""}`);
  }

  const base = `/clubs/${club.id}/finances`;
  // Canonical params for links: period, branch and list filters (no page or notices).
  const query: Record<string, string> = { ...period.params, ...(branchId ? { branch: branchId } : {}), ...(list.tab ? { kind: list.tab } : {}), ...(list.categoryParam ? { category: list.categoryParam } : {}), ...(list.search ? { q: list.search } : {}) };
  const activeBranches = scope.options.filter((b) => !b.archived_at).map((b) => ({ id: b.id, name: b.name }));
  const addBranchId = scope.selected && !scope.selected.archived_at ? branchId : "";

  // After recording: if the record falls outside this period or branch, offer to switch to it.
  const recorded = sp.notice === "recorded" && typeof sp.recorded === "string" && daySchema.safeParse(sp.recorded).success ? sp.recorded : "";
  const recordedBranch = typeof sp.recorded_branch === "string" && idSchema.safeParse(sp.recorded_branch).success ? sp.recorded_branch : "";
  const outsideBranch = !!branchId && recordedBranch !== branchId;
  const outsidePeriod = !!recorded && (recorded < period.start || recorded > period.last);
  const outside = !!recorded && (outsidePeriod || outsideBranch);
  const viewRecorded = financeHref(base, { date: recorded, ...(outsideBranch ? (recordedBranch ? { branch: recordedBranch } : {}) : branchId ? { branch: branchId } : {}) });

  // Transaction tabs keep a category only if it belongs to the new tab; pages restart at 1.
  const tabHref = (tab: "" | "income" | "expense") => financeHref(base, query, { kind: tab || undefined, category: !tab || tab === list.categoryKind ? list.categoryParam || undefined : undefined, page: undefined });
  const pages = transactions.ok ? Math.max(1, Math.ceil(transactions.count / PAGE_SIZE)) : 1;
  const filtered = !!(list.tab || list.category || list.search);
  const scopeText = scope.selected ? ` at ${scope.selected.name}` : "";

  return <>
    {/* Recording (existing modals: validation, categories, permissions, duplicate-submit protection) */}
    <PageHeader title="Finance" description={`Track ${club.name}'s income and expenses.`} actions={<>
      <AddTransactionDialog action={addTransaction.bind(null, club.id)} clubName={club.name} kind="income" today={today} branchId={addBranchId} branches={activeBranches} categories={clubCategories} className="flex-1 sm:flex-none" />
      <AddTransactionDialog action={addTransaction.bind(null, club.id)} clubName={club.name} kind="expense" today={today} branchId={addBranchId} branches={activeBranches} categories={clubCategories} variant="outline" className="flex-1 sm:flex-none" />
    </>} />

    {sp.notice === "recorded" && (
      <SuccessNote className="mb-6">
        Transaction recorded.
        {outside && <>
          <span>It&apos;s outside the selected {outsidePeriod && outsideBranch ? "period and branch" : outsideBranch ? "branch" : "period"}, so it isn&apos;t shown here.</span>
          <Link href={viewRecorded} className="font-semibold underline underline-offset-2 hover:text-emerald-700">View transaction</Link>
        </>}
      </SuccessNote>
    )}

    {/* 1–2: period and branch scope everything below. */}
    <FinanceControls base={base} query={query} period={period} today={today} selected={branchId} branches={scope.options} />

    {/* 3: summary */}
    <SummaryCards totals={totals} />

    {/* 5: breakdowns */}
    <div className="grid gap-6 lg:grid-cols-2">
      <CategoryBreakdown id="income-by-category" title="Income by category" kind="income" rows={categories.ok ? labelled("income", categories.income) : null} />
      <CategoryBreakdown id="expenses-by-category" title="Expenses by category" kind="expense" rows={categories.ok ? labelled("expense", categories.expense) : null} />
    </div>

    {branches && (
      <section aria-labelledby="branch-breakdown" className="mt-10">
        <h2 id="branch-breakdown">By branch</h2>
        <p className="mb-4 mt-0.5 text-[0.8125rem] text-slate-500">Club-level records have no branch. Rows add up to the totals above.</p>
        {!branches.ok ? <p role="alert" className="panel text-sm text-slate-600">Unable to load the branch breakdown. Reload the page to try again.</p> : (() => {
          const byBranch = new Map(branches.rows.map((r) => [r.branchId, r]));
          // Current branches always; archived ones only when they have records in this period.
          const ids = [...new Set([...scope.options.filter((b) => !b.archived_at).map((b) => b.id), ...branches.rows.flatMap((r) => (r.branchId ? [r.branchId] : []))])];
          const rows: CashFlowRow[] = ids
            .map((id) => ({ key: id, label: names.get(id) ?? "Branch", income: byBranch.get(id)?.income ?? ZERO, expense: byBranch.get(id)?.expense ?? ZERO }))
            .sort((a, b) => String(a.label).localeCompare(String(b.label)));
          const clubLevel = byBranch.get(null);
          rows.push({ key: "club-level", label: "Club-level", income: clubLevel?.income ?? ZERO, expense: clubLevel?.expense ?? ZERO });
          const sum = (pick: (r: CashFlowRow) => bigint) => rows.reduce((s, r) => s + pick(r), ZERO);
          return <CashFlowTable caption={`Income and expenses by branch, ${period.range}`} column="Branch" rows={rows} total={{ label: "All branches", income: sum((r) => r.income), expense: sum((r) => r.expense) }} />;
        })()}
      </section>
    )}

    {monthly && (
      <section aria-labelledby="ytd-breakdown" className="mt-10">
        <h2 id="ytd-breakdown">{period.start.slice(0, 4)} year to date by month</h2>
        <p className="mb-4 mt-0.5 text-[0.8125rem] text-slate-500">1 January to today{scopeText}. Months without records show zero.</p>
        {!monthly.ok ? <p role="alert" className="panel text-sm text-slate-600">Unable to load the monthly breakdown. Reload the page to try again.</p> : (() => {
          const rows: CashFlowRow[] = monthsOf(period).map((m) => ({
            key: m,
            label: m === today.slice(0, 7) ? <>{monthName(m).split(" ")[0]} <span className="ml-1.5 whitespace-nowrap rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary ring-1 ring-inset ring-primary/15">Month to date</span></> : monthName(m).split(" ")[0],
            income: monthly.byMonth.get(m)?.income ?? ZERO,
            expense: monthly.byMonth.get(m)?.expense ?? ZERO,
          }));
          const sum = (pick: (r: CashFlowRow) => bigint) => rows.reduce((s, r) => s + pick(r), ZERO);
          return <CashFlowTable caption={`Income and expenses by month, ${period.range}`} column="Month" rows={rows} total={{ label: "Year to date", income: sum((r) => r.income), expense: sum((r) => r.expense) }} />;
        })()}
      </section>
    )}

    {/* 6: transactions (list filters don't affect anything above) */}
    <section aria-labelledby="transactions-heading" className="mt-10">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 id="transactions-heading" className="text-xl! tracking-[-0.02em]!">Transactions</h2>
        <p className="text-[0.8125rem] text-slate-500">{period.range}{scopeText}</p>
      </div>
      <ViewTabs label="Transaction type" tabs={[
        { href: tabHref(""), label: "All", active: !list.tab },
        { href: tabHref("income"), label: "Income", active: list.tab === "income" },
        { href: tabHref("expense"), label: "Expenses", active: list.tab === "expense" },
      ]} />
      <TransactionFilters key={`${list.search}|${list.categoryParam}|${list.tab}`} base={base} query={query} tab={list.tab} category={list.categoryParam} search={list.search} categories={clubCategories} />

      {!transactions.ok ? <p role="alert" className="panel text-sm text-slate-600">Unable to load transactions. Reload the page to try again.</p> : <>
        {/* Subtotal of every record matching the list filters (not just this page). */}
        <div className="mb-3 flex flex-wrap items-center gap-x-5 gap-y-1 rounded-xl border border-border bg-white px-4 py-2.5 text-sm" aria-live="polite">
          <span className="font-semibold">{filtered ? "Filtered subtotal" : "Subtotal"}</span>
          <span className="text-slate-500">{transactions.count} {transactions.count === 1 ? "transaction" : "transactions"}</span>
          {list.kind !== "expense" && <span>Income <span className="font-semibold tabular-nums text-primary">+{formatMYR(transactions.income.toString())}</span></span>}
          {list.kind !== "income" && <span>Expenses <span className="font-semibold tabular-nums">−{formatMYR(transactions.expense.toString())}</span></span>}
          {!list.kind && <span>Net <span className="font-semibold tabular-nums">{formatSignedMYR(transactions.income - transactions.expense)}</span></span>}
        </div>

        {transactions.rows.length ? (
          <TransactionTable rows={transactions.rows} branchNames={names} categories={clubCategories} caption={`Transactions, ${period.range}${scopeText}`} />
        ) : (
          page > 1 && transactions.count > 0
            ? <EmptyState title="No transactions on this page" action={<Link href={financeHref(base, query)} className={buttonVariants({ variant: "outline", size: "sm" })}>Go to the first page</Link>} />
            : filtered
              ? <EmptyState
                  title="No transactions match these filters"
                  description={<>Nothing{list.category ? ` in ${categoryLabel(list.categoryKind || "income", list.category === "uncategorised" ? null : list.category, clubCategories)}` : ""}{list.search ? ` matching “${list.search}”` : ""} for {period.range}{scopeText}.</>}
                  action={<Link href={financeHref(base, query, { kind: undefined, category: undefined, q: undefined })} className={buttonVariants({ variant: "outline", size: "sm" })}>Clear transaction filters</Link>}
                />
              : <EmptyState image={assets.ledger} title="No transactions in this period" description="Use Record income or Record expense to add money actually received or paid." />
        )}

        {pages > 1 || page > 1 ? <Pagination page={page} pages={Math.max(pages, page)} previousHref={page > 1 ? financeHref(base, query, { page: String(page - 1) }) : undefined} nextHref={page < pages ? financeHref(base, query, { page: String(page + 1) }) : undefined} /> : null}
      </>}
    </section>
  </>;
}
