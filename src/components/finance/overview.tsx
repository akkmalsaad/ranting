import { ArrowDownLeft, ArrowUpRight, Scale } from "lucide-react";
import { builtinCategories, categoryLabel, formatMYR, formatSignedMYR, type ClubCategories, type TransactionKind } from "@/lib/finance/values";
import type { CategoryRow, TransactionRow } from "@/lib/finance/queries";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { StatCard } from "@/components/stat-card";
import { Badge } from "@/components/ui/badge";

// Finance overview building blocks (server components). Amounts are integer sen as BigInt from
// database aggregates; nothing here adds up a loaded page of records.

type Totals = { ok: true; income: bigint; expense: bigint } | { ok: false };
const ZERO = BigInt(0);
const signed = (kind: TransactionKind, sen: number | bigint) => `${kind === "income" ? "+" : "−"}${formatMYR(sen.toString())}`;
const recordedOn = new Intl.DateTimeFormat("en-MY", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kuala_Lumpur" });

/** Income received, expenses paid and net cash flow for the selected period and branch. */
export function SummaryCards({ totals }: { totals: Totals }) {
  const note = (text: string) => (totals.ok ? text : "Unable to load");
  return (
    <section aria-labelledby="finance-summary" className="mb-8">
      <h2 id="finance-summary" className="sr-only">Summary</h2>
      {!totals.ok && <p role="alert" className="mb-3 rounded-xl border border-red-200/70 bg-red-50 px-4 py-3 text-sm text-red-800">We couldn&apos;t load the totals for this period. Reload the page to try again.</p>}
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Income received" value={totals.ok ? formatMYR(totals.income.toString()) : "—"} note={note("Payments received")} icon={ArrowDownLeft} tone="positive" />
        <StatCard label="Expenses paid" value={totals.ok ? formatMYR(totals.expense.toString()) : "—"} note={note("Payments made")} icon={ArrowUpRight} />
        <StatCard label="Net cash flow" value={totals.ok ? formatSignedMYR(totals.income - totals.expense) : "—"} note={note("Income received − expenses paid")} icon={Scale} tone="featured" />
      </div>
      <p className="mt-2.5 text-xs text-slate-500">Based on recorded payments received and expenses paid.</p>
    </section>
  );
}

/** Share of a total in tenths of a percent, rounded; null when the total is zero. */
function tenthsOf(part: bigint, total: bigint) {
  if (total <= ZERO) return null;
  return Number((part * BigInt(1000) + total / BigInt(2)) / total);
}

/** One kind's totals by category with share of the section total and a bar (largest first). */
export function CategoryBreakdown({ id, title, kind, rows }: { id: string; title: string; kind: TransactionKind; rows: CategoryRow[] | null }) {
  const total = rows?.reduce((sum, r) => sum + r.sen, ZERO) ?? ZERO;
  return (
    <section aria-labelledby={id} className="min-w-0 rounded-2xl border border-border bg-white p-5 sm:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 id={id}>{title}</h2>
        {rows && <p className="text-[0.9375rem] font-semibold tabular-nums">{formatMYR(total.toString())}</p>}
      </div>
      {!rows ? <p role="alert" className="mt-4 text-sm text-slate-600">Unable to load this breakdown. Reload the page to try again.</p>
        : total === ZERO ? <p className="mt-4 text-sm text-slate-600">No {kind === "income" ? "income" : "expenses"} recorded in this period.</p>
        : (
          <ul className="mt-4 space-y-3.5">
            {rows.map((r) => {
              const tenths = tenthsOf(r.sen, total) ?? 0;
              const share = tenths === 0 ? "<0.1%" : `${(tenths / 10).toFixed(1)}%`;
              return (
                <li key={r.category ?? "uncategorised"}>
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span className={cn("min-w-0 break-words font-medium", !r.category && "text-slate-500")}>{r.label}</span>
                    <span className="shrink-0 text-right tabular-nums"><span className="font-semibold">{formatMYR(r.sen.toString())}</span> <span className="text-slate-500">· {share}</span></span>
                  </div>
                  <div aria-hidden className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                    <div className={cn("h-full rounded-full", kind === "income" ? "bg-primary" : "bg-navy/70")} style={{ width: `${Math.max(tenths / 10, 1)}%` }} />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
    </section>
  );
}

export type CashFlowRow = { key: string; label: React.ReactNode; income: bigint; expense: bigint };

/**
 * Income, expenses and net cash flow per row with a total row: a table from md, readable cards
 * below. Used for the branch and year-to-date month breakdowns.
 */
export function CashFlowTable({ caption, column, rows, total }: { caption: string; column: string; rows: CashFlowRow[]; total: { label: string; income: bigint; expense: bigint } }) {
  const money = (sen: bigint) => formatMYR(sen.toString());
  return <>
    <div className="hidden overflow-x-auto rounded-2xl border border-border bg-white md:block">
      <table className="data-table">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            <th scope="col" className="px-5 py-3">{column}</th>
            <th scope="col" className="px-5 py-3 text-right">Income</th>
            <th scope="col" className="px-5 py-3 text-right">Expenses</th>
            <th scope="col" className="whitespace-nowrap px-5 py-3 text-right">Net cash flow</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((r) => (
            <tr key={r.key} className="align-middle hover:bg-slate-50/80">
              <th scope="row" className="min-w-44 px-5 py-3.5 font-semibold">{r.label}</th>
              <td className="whitespace-nowrap px-5 py-3.5 text-right tabular-nums">{money(r.income)}</td>
              <td className="whitespace-nowrap px-5 py-3.5 text-right tabular-nums">{money(r.expense)}</td>
              <td className="whitespace-nowrap px-5 py-3.5 text-right font-semibold tabular-nums">{formatSignedMYR(r.income - r.expense)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot className="border-t border-border bg-slate-50/80">
          <tr>
            <th scope="row" className="px-5 py-3.5 font-bold">{total.label}</th>
            <td className="whitespace-nowrap px-5 py-3.5 text-right font-bold tabular-nums">{money(total.income)}</td>
            <td className="whitespace-nowrap px-5 py-3.5 text-right font-bold tabular-nums">{money(total.expense)}</td>
            <td className="whitespace-nowrap px-5 py-3.5 text-right font-bold tabular-nums text-primary">{formatSignedMYR(total.income - total.expense)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
    <ul aria-label={caption} className="overflow-hidden rounded-2xl border border-border bg-white md:hidden">
      {[...rows, { key: "__total", label: total.label, income: total.income, expense: total.expense }].map((r) => (
        <li key={r.key} className={cn("border-b border-border px-4 py-4 last:border-b-0", r.key === "__total" && "bg-slate-50/80")}>
          <p className={cn("break-words", r.key === "__total" ? "font-bold" : "font-semibold")}>{r.label}</p>
          <dl className="mt-2 grid grid-cols-3 gap-2 text-sm">
            <div className="min-w-0"><dt className="text-xs text-slate-500">Income</dt><dd className="break-words font-medium tabular-nums">{money(r.income)}</dd></div>
            <div className="min-w-0"><dt className="text-xs text-slate-500">Expenses</dt><dd className="break-words font-medium tabular-nums">{money(r.expense)}</dd></div>
            <div className="min-w-0"><dt className="text-xs text-slate-500">Net</dt><dd className="break-words font-semibold tabular-nums">{formatSignedMYR(r.income - r.expense)}</dd></div>
          </dl>
        </li>
      ))}
    </ul>
  </>;
}

function KindBadge({ kind }: { kind: TransactionKind }) {
  return kind === "income" ? <Badge tone="brand" icon={ArrowDownLeft}>Income</Badge> : <Badge icon={ArrowUpRight}>Expense</Badge>;
}

/** Combined income/expense records: a table matching Students/Branches from md, cards below. */
export function TransactionTable({ rows, caption, branchNames, categories = builtinCategories }: { rows: TransactionRow[]; caption: string; branchNames: Map<string, string>; categories?: ClubCategories }) {
  const branch = (id: string | null) => (id ? branchNames.get(id) ?? "Branch" : "Club-level");
  const amountClass = (kind: TransactionKind) => cn("whitespace-nowrap font-semibold tabular-nums", kind === "income" ? "text-primary" : "text-foreground");
  return <>
    <div className="hidden overflow-x-auto rounded-2xl border border-border bg-white md:block">
      <table className="data-table">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            <th scope="col" className="px-5 py-3">Description</th>
            <th scope="col" className="px-5 py-3">Type</th>
            <th scope="col" className="px-5 py-3">Category</th>
            <th scope="col" className="px-5 py-3">Branch</th>
            <th scope="col" className="px-5 py-3">Date</th>
            <th scope="col" className="px-5 py-3 text-right">Amount</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((t) => (
            <tr key={`${t.kind}-${t.id}`} title={`Record ${t.id}`} className="align-middle hover:bg-slate-50/80">
              <td className="min-w-52 px-5 py-3.5"><p className="break-words font-semibold">{t.description}</p><p className="mt-0.5 text-xs text-slate-500">Recorded {recordedOn.format(new Date(t.created_at))}</p></td>
              <td className="px-5 py-3.5"><KindBadge kind={t.kind} /></td>
              <td className={cn("min-w-36 px-5 py-3.5", !t.category && "text-slate-500")}>{categoryLabel(t.kind, t.category, categories)}</td>
              <td className="min-w-32 break-words px-5 py-3.5 text-slate-600">{branch(t.branch_id)}</td>
              <td className="whitespace-nowrap px-5 py-3.5 text-slate-600">{formatDate(t.occurred_on)}</td>
              <td className={cn("px-5 py-3.5 text-right", amountClass(t.kind))}>{signed(t.kind, t.amount_sen)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
    <ul aria-label={caption} className="overflow-hidden rounded-2xl border border-border bg-white md:hidden">
      {rows.map((t) => (
        <li key={`${t.kind}-${t.id}`} title={`Record ${t.id}`} className="border-b border-border px-4 py-4 last:border-b-0">
          <div className="flex items-start justify-between gap-3">
            <p className="min-w-0 break-words font-semibold">{t.description}</p>
            <p className={cn("shrink-0", amountClass(t.kind))}>{signed(t.kind, t.amount_sen)}</p>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-slate-600">
            <KindBadge kind={t.kind} />
            <span className={cn(!t.category && "text-slate-500")}>{categoryLabel(t.kind, t.category, categories)}</span>
          </div>
          <p className="mt-1 text-sm text-slate-600">{formatDate(t.occurred_on)} · {branch(t.branch_id)}</p>
        </li>
      ))}
    </ul>
  </>;
}
