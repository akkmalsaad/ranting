"use client";
import { useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { buttonVariants } from "@/components/ui/button";
import { FeeStatusPill } from "@/components/fees/fee-status-badge";
import { BRANCH_TONES, type BranchColorKey } from "@/lib/branch-colors";
import { formatMYR } from "@/lib/finance/values";
import { billingPeriodLabel, paidPercent, shortDueDate } from "@/lib/fees/display";
import { feesHref } from "@/lib/fees/values";
import type { FeeRow } from "@/lib/fees/queries";
import { cn } from "@/lib/utils";

/** Branch label data for a row: full name, optional short code and its resolved palette colour. */
export type FeeBranchInfo = { name: string; code: string | null; color: BranchColorKey };

const money = (sen: number) => formatMYR(sen);
const payable = (r: FeeRow) => r.status !== "voided" && r.balance_sen > 0;

/**
 * Fees list. From a 56rem-wide container (a container query, so the sidebar is accounted for) it's
 * a five-column fixed-layout table; narrower, each fee is a stacked card. A row or card click (or
 * Enter/Space when it's focused) opens the fee's details panel (`?fee=…`, the existing details URL);
 * closing it returns focus to the row. "Record" goes straight to Record payment.
 */
export function FeeList({ rows, today, base, listQuery, branches, showBranch }: {
  rows: FeeRow[];
  /** Malaysia date (YYYY-MM-DD) from the server, for "Due today" / "4 days late". */
  today: string;
  base: string;
  /** The list's current filters and page, kept in the details and Record links. */
  listQuery: Record<string, string>;
  branches: Record<string, FeeBranchInfo>;
  /** False for a one-branch club or a single-branch filter (shared rule with Classes). */
  showBranch: boolean;
}) {
  const router = useRouter();
  const openFee = useSearchParams().get("fee");
  const lastOpened = useRef<string | null>(null);
  const detailsHref = (id: string) => feesHref(base, listQuery, { fee: id });
  const payHref = (id: string) => feesHref(base, listQuery, { fee: id, action: "pay" });

  // When the details panel closes (the `fee` param goes away), focus the row it was opened from.
  useEffect(() => {
    if (openFee) { lastOpened.current = openFee; return; }
    const id = lastOpened.current;
    lastOpened.current = null;
    if (!id) return;
    const target = [...document.querySelectorAll<HTMLElement>(`[data-fee-row="${CSS.escape(id)}"]`)].find((el) => el.offsetParent !== null);
    target?.focus();
  }, [openFee]);

  const open = (id: string) => { lastOpened.current = id; router.push(detailsHref(id), { scroll: false }); };
  // Clicks on the row's own links/buttons keep their meaning; selecting text doesn't open the panel.
  const onClick = (event: React.MouseEvent, id: string) => {
    if ((event.target as HTMLElement).closest("a, button") || window.getSelection()?.toString()) return;
    open(id);
  };
  const onKeyDown = (event: React.KeyboardEvent, id: string) => {
    if (event.target !== event.currentTarget || (event.key !== "Enter" && event.key !== " ")) return;
    event.preventDefault();
    open(id);
  };
  const rowProps = (r: FeeRow) => ({
    "data-fee-row": r.id,
    tabIndex: 0,
    onClick: (e: React.MouseEvent) => onClick(e, r.id),
    onKeyDown: (e: React.KeyboardEvent) => onKeyDown(e, r.id),
  });
  const feeLink = (r: FeeRow, className?: string) => (
    <Link href={detailsHref(r.id)} scroll={false} onClick={() => { lastOpened.current = r.id; }} className={cn("hover:text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary", className)} title={r.title}>{r.title}</Link>
  );
  const record = (r: FeeRow, className?: string) => payable(r) && (
    <Link href={payHref(r.id)} scroll={false} onClick={() => { lastOpened.current = r.id; }} aria-label={`Record payment for ${r.student_name}, ${r.title} ${billingPeriodLabel(r.fee_type, r.billing_month)}`} className={cn(buttonVariants({ variant: "outline", size: "sm" }), className)}>Record</Link>
  );

  return (
    <div className="@container">
      <div className="hidden overflow-hidden rounded-2xl border border-border bg-white @4xl:block">
        <table className="data-table table-fixed">
          <caption className="sr-only">Fees. Select a row to see its details and payment history.</caption>
          <colgroup>
            <col />
            <col />
            <col className="w-40" />
            <col className="w-36" />
            <col className="w-28" />
          </colgroup>
          <thead>
            <tr>
              <th scope="col" className="px-4">Student</th>
              <th scope="col" className="px-4">Fee</th>
              <th scope="col" className="px-4">Due</th>
              <th scope="col" className="px-4 text-right">Balance</th>
              <th scope="col" className="px-4 text-right"><span className="sr-only">Action</span></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} {...rowProps(r)} className="cursor-pointer align-middle hover:bg-slate-50/80 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary">
                <td className="px-4 py-3">
                  <span className="block truncate font-medium" title={r.student_name}>{r.student_name}</span>
                  {(showBranch || r.student_archived) && <StudentMeta row={r} branches={branches} showBranch={showBranch} />}
                </td>
                <td className="px-4 py-3">
                  {feeLink(r, "block truncate")}
                  <span className="mt-0.5 block truncate text-xs text-slate-600">{billingPeriodLabel(r.fee_type, r.billing_month)}</span>
                </td>
                <td className="px-4 py-3">
                  <FeeStatusPill fee={r} today={today} />
                  <span className="mt-1 block text-xs text-slate-600"><span className="sr-only">Due </span>{shortDueDate(r.due_date, today)}</span>
                </td>
                <td className="px-4 py-3 text-right"><Balance row={r} /></td>
                <td className="px-4 py-3 text-right">{record(r)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul aria-label="Fees" className="overflow-hidden rounded-2xl border border-border bg-white @4xl:hidden">
        {rows.map((r) => (
          <li key={r.id} {...rowProps(r)} className="cursor-pointer border-b border-border px-4 py-3.5 last:border-b-0 hover:bg-slate-50/80 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <span className="block truncate font-medium">{r.student_name}</span>
                {(showBranch || r.student_archived) && <StudentMeta row={r} branches={branches} showBranch={showBranch} />}
              </div>
              <div className="shrink-0 text-right"><Balance row={r} /></div>
            </div>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
              <span className="flex min-w-0 text-sm text-slate-600">
                {feeLink(r, "min-w-0 truncate font-medium text-foreground")}
                <span className="shrink-0 whitespace-pre"> · {billingPeriodLabel(r.fee_type, r.billing_month)}</span>
              </span>
              <span className="inline-flex items-center gap-2">
                <span className="text-xs text-slate-600"><span className="sr-only">Due </span>{shortDueDate(r.due_date, today)}</span>
                <FeeStatusPill fee={r} today={today} />
              </span>
            </div>
            {record(r, "mt-3 w-full")}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Line 2 under the student: branch short-code badge (in the branch colour) and full name; archived marker. */
function StudentMeta({ row, branches, showBranch }: { row: FeeRow; branches: Record<string, FeeBranchInfo>; showBranch: boolean }) {
  const branch = row.branch_id ? branches[row.branch_id] : undefined;
  return (
    <span className="mt-0.5 flex min-w-0 items-center gap-1.5 text-xs text-slate-600">
      {showBranch && (branch ? <>
        {branch.code
          ? <span aria-hidden className={cn("shrink-0 rounded px-1 text-[10px] font-semibold leading-4 tracking-wide", BRANCH_TONES[branch.color].badge)}>{branch.code}</span>
          : <span aria-hidden className={cn("size-2 shrink-0 rounded-full", BRANCH_TONES[branch.color].dot)} />}
        <span className="truncate">{branch.name}</span>
      </> : <span className="truncate">{row.branch_id ? "Branch" : "Club-level"}</span>)}
      {row.student_archived && <span className="shrink-0">{showBranch ? "· " : ""}Archived student</span>}
    </span>
  );
}

/** Balance column: bold balance with "of RM20.00", or a paid/amount bar when partly paid. */
function Balance({ row }: { row: FeeRow }) {
  if (row.status === "voided") return <><span aria-hidden className="text-slate-400">—</span><span className="sr-only">No balance (voided)</span></>;
  if (row.status === "paid" || row.balance_sen <= 0) return <span className="text-sm text-slate-500">Paid</span>;
  const partial = row.paid_sen > 0;
  return (
    <>
      <span className="block font-semibold tabular-nums">{money(row.balance_sen)}</span>
      {partial ? (
        <>
          <span aria-hidden className="ml-auto mt-1.5 block h-[3px] w-20 max-w-full overflow-hidden rounded-full bg-slate-200">
            <span className="block h-full rounded-full bg-emerald-600" style={{ width: `${paidPercent(row.paid_sen, row.amount_sen)}%` }} />
          </span>
          <span className="sr-only">{money(row.paid_sen)} of {money(row.amount_sen)} paid</span>
        </>
      ) : <span className="mt-0.5 block text-xs tabular-nums text-slate-600">of {money(row.amount_sen)}</span>}
    </>
  );
}
