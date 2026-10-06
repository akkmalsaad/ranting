import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, ArrowLeft, CircleCheck, Hourglass, ReceiptText } from "lucide-react";
import { clubClient, requireClub } from "@/lib/clubs";
import { listBeltLevels } from "@/lib/belt-levels";
import { branchScope } from "@/lib/finance/queries";
import { categoryLabel, formatMYR } from "@/lib/finance/values";
import { chargeableStudents, feeSummary, linkableReceipts, listFees, loadFee } from "@/lib/fees/queries";
import { FEE_STATUS_FILTERS, billingMonthLabel, feeFilters, feeQuery, feeTypeLabel, feesHref, methodLabel } from "@/lib/fees/values";
import { resolveBranchColors, showBranchDetail } from "@/lib/branch-colors";
import { formatDate } from "@/lib/format";
import { idSchema, pageNumber, searchTerm, todayInMalaysia } from "@/lib/validation";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/page-header";
import { ViewTabs } from "@/components/view-tabs";
import { Notice } from "@/components/notice";
import { Button, buttonVariants } from "@/components/ui/button";
import { SearchInput } from "@/components/ui/input";
import { StatCard } from "@/components/stat-card";
import { EmptyState } from "@/components/empty-state";
import { Pagination } from "@/components/pagination";
import { SuccessNote } from "@/components/notice";
import { FeeControls } from "@/components/fees/fee-controls";
import { FeeStatusPill } from "@/components/fees/fee-status-badge";
import { FeeList, type FeeBranchInfo } from "@/components/fees/fee-list";
import { FeeSearch } from "@/components/fees/fee-search";
import { FeeActionsMenu } from "@/components/fees/fee-actions-menu";
import { AddFeeDialog, EditFeeForm } from "@/components/fees/add-fee-dialog";
import { GenerateFeesDialog } from "@/components/fees/generate-fees-dialog";
import { WhatsAppReminderDialog } from "@/components/fees/whatsapp-reminder-dialog";
import { FeeModal, LinkReceiptForm, PaymentForm, ReasonForm } from "@/components/fees/fee-forms";
import { loadClubCategories, loadClubSettings } from "@/lib/club-settings";
import { addFeeBatch, editFee, feeReminderSummary, generateMonthlyFees, linkFeeReceipt, previewMonthlyFees, recordFeePayment, reverseAllocation, voidFee } from "./actions";

export const metadata = { title: "Fees" };

const PAGE_SIZE = 25;
const recordedAt = new Intl.DateTimeFormat("en-MY", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kuala_Lumpur" });
const money = (sen: number | bigint) => formatMYR(sen.toString());
const smallButton = buttonVariants({ variant: "outline", size: "sm" });

/**
 * Fees: charges per student with paid/balance from payment allocations. Billing period (`month`
 * or `scope=outstanding`) and `branch` scope the summary and list; `status` and `q` filter the
 * list. `fee` (+ `action`) opens the fee modal. Lists and totals are database aggregates over every
 * matching fee, scoped by owner-only RLS.
 */
export default async function Fees({ params, searchParams }: PageProps<"/clubs/[clubId]/fees">) {
  const { clubId } = await params;
  const sp = await searchParams;
  const today = todayInMalaysia();
  // The no-JavaScript filter form submits `period` (a month or "outstanding").
  const input: Record<string, unknown> = { ...sp, ...(sp.period === "outstanding" ? { scope: "outstanding", month: undefined } : typeof sp.period === "string" && sp.period ? { month: sp.period, scope: undefined } : {}) };
  const filters = feeFilters(input, today);
  if (!filters) notFound();
  const page = pageNumber(sp.page);
  const feeId = typeof sp.fee === "string" && idSchema.safeParse(sp.fee).success ? sp.fee : "";
  const action = typeof sp.action === "string" ? sp.action : "";

  const { db } = await clubClient(clubId);
  const [{ club }, scope, summary, list, students, detail, beltLevels, settings, { categories }] = await Promise.all([
    requireClub(clubId),
    branchScope(clubId, filters.branch),
    feeSummary(clubId, filters),
    listFees(clubId, filters, page, PAGE_SIZE),
    chargeableStudents(clubId),
    feeId ? loadFee(clubId, feeId) : null,
    listBeltLevels(db, clubId).catch(() => []),
    loadClubSettings(clubId),
    loadClubCategories(clubId),
  ]);
  const fee = detail?.ok ? detail.fee : null;
  const receipts = fee && action === "link" ? await linkableReceipts(clubId, searchTerm(sp.rq)) : null;

  const base = `/clubs/${club.id}/fees`;
  const query = feeQuery(filters, today);
  const listQuery = { ...query, ...(page > 1 ? { page: String(page) } : {}) };
  const returnQuery = new URLSearchParams(listQuery).toString();
  const feeHref = (id: string, nextAction?: string) => feesHref(base, listQuery, { fee: id, action: nextAction });
  const closeHref = feesHref(base, listQuery);
  const names = new Map(scope.options.map((b) => [b.id, `${b.name}${b.archived_at ? " (archived)" : ""}`]));
  const branchName = (id: string | null) => (id ? names.get(id) ?? "Branch" : "Club-level");
  const activeBranches = scope.options.filter((b) => !b.archived_at).map((b) => ({ id: b.id, name: b.name }));
  // New charges: active students whose branch is current (or none); belts shown where assigned.
  const archivedBranchIds = new Set(scope.options.filter((b) => b.archived_at).map((b) => b.id));
  const beltById = new Map(beltLevels.map((l) => [l.id, { name: l.name, color: l.color, stripe: l.stripe_color }]));
  const feeStudents = (students ?? []).filter((s) => !s.branch_id || !archivedBranchIds.has(s.branch_id))
    .map((s) => ({ id: s.id, full_name: s.full_name, branch_id: s.branch_id, belt: s.belt_level_id ? beltById.get(s.belt_level_id) ?? null : null }));
  const pages = list.ok ? Math.max(1, Math.ceil(list.count / PAGE_SIZE)) : 1;
  // Row branch labels: full name, short code and colour (saved, else the shared id-order fallback),
  // shown unless the club has one current branch or one branch is filtered (same rule as Classes).
  const colors = resolveBranchColors(scope.options);
  const branchInfo: Record<string, FeeBranchInfo> = Object.fromEntries(scope.options.map((b) => [b.id, { name: `${b.name}${b.archived_at ? " (archived)" : ""}`, code: b.short_code, color: colors.get(b.id)! }]));
  const showBranch = showBranchDetail({ filtered: !!filters.branch, activeBranches: activeBranches.length, branchIdsInView: list.ok ? list.rows.map((r) => r.branch_id) : [] });
  const filtered = !!(filters.status || filters.search);
  const scopeText = `${filters.outstanding ? "All outstanding fees, every billing month" : `Fees billed for ${billingMonthLabel(filters.month)}`} · ${scope.selected ? branchName(scope.selected.id) : "All branches"}`;

  const n = (v: unknown) => { const x = Number(v); return Number.isInteger(x) && x >= 0 && x <= 500 ? x : null; };
  const created = n(sp.created), skipped = n(sp.skipped);
  const notices: Record<string, string> = {
    "fees-added": created === null ? "Fees added." : `${created} one-off ${created === 1 ? "fee" : "fees"} created.`,
    generated: created === null ? "Monthly fees generated." : `${created} monthly ${created === 1 ? "fee" : "fees"} created${skipped ? `; ${skipped} skipped (already charged or no longer eligible)` : ""}.`,
    payment: "Payment recorded. It's also in Finance as income on the payment date.",
    linked: "Receipt linked to this fee. No new income was recorded.",
    "fee-updated": "Fee updated.",
    voided: "Fee voided. It stays available under the Voided filter.",
    reversed: "Allocation removed. The fee balance is reopened; the Finance receipt is unchanged.",
  };

  return <>
    <PageHeader title="Fees" description="Charges, payments and balances for your students." actions={<>
      <AddFeeDialog create={addFeeBatch.bind(null, club.id)} students={feeStudents} branches={activeBranches} today={today} month={filters.month || today.slice(0, 7)} branchId={filters.branch} />
      <GenerateFeesDialog preview={previewMonthlyFees.bind(null, club.id)} generate={generateMonthlyFees.bind(null, club.id)} branches={activeBranches} today={today} month={filters.month || today.slice(0, 7)} branchId={filters.branch} defaults={{ amountSen: settings.monthlyFeeSen, dueDay: settings.dueDay }} />
      <WhatsAppReminderDialog summarize={feeReminderSummary.bind(null, club.id)} branches={activeBranches} clubName={club.name} today={today} month={filters.month || today.slice(0, 7)} branchId={filters.branch} />
    </>} />
    {!feeId && <Notice code={sp.notice} messages={notices} />}

    <FeeControls base={base} query={query} month={filters.month} outstanding={filters.outstanding} today={today} selected={filters.branch} branches={scope.options} />

    {/* Summary for the billing scope and branch (not the status filter or search). */}
    <section aria-labelledby="fee-summary" className="mb-8">
      <h2 id="fee-summary" className="mb-3 text-[0.8125rem]! font-medium! tracking-normal! text-slate-500">{scopeText}</h2>
      {!summary.ok && <p role="alert" className="mb-3 rounded-xl border border-red-200/70 bg-red-50 px-4 py-3 text-sm text-red-800">We couldn&apos;t load the fee totals. Reload the page to try again.</p>}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total charged" value={summary.ok ? money(summary.charged) : "—"} note={summary.ok ? `${summary.count} ${summary.count === 1 ? "fee" : "fees"}, not voided` : "Unable to load"} icon={ReceiptText} />
        <StatCard label="Collected" value={summary.ok ? money(summary.collected) : "—"} note={summary.ok ? "Payments allocated to these fees" : "Unable to load"} icon={CircleCheck} tone="positive"
          info="Totals are for the charges in this view. Collected counts payments allocated to these fees, so it can differ from Finance income for the same month, which uses the actual payment date." />
        <StatCard label="Outstanding" value={summary.ok ? money(summary.outstanding) : "—"} note={summary.ok ? "Remaining balances" : "Unable to load"} icon={Hourglass} tone="featured" />
        <StatCard label="Overdue" value={summary.ok ? money(summary.overdue) : "—"} note={summary.ok ? "Part of outstanding; due before today" : "Unable to load"} icon={AlertTriangle} tone="warning" />
      </div>
    </section>

    <section aria-labelledby="fee-list">
      <h2 id="fee-list" className="sr-only">Fee list</h2>
      <ViewTabs label="Fee status" tabs={FEE_STATUS_FILTERS.map((s) => ({ href: feesHref(base, query, { status: s.value || undefined, page: undefined }), label: s.label, active: filters.status === s.value }))} />
      <FeeSearch base={base} query={query} value={filters.search} />

      {!list.ok ? <p role="alert" className="panel text-sm text-slate-600">Unable to load fees. Reload the page to try again.</p>
        : list.rows.length === 0 ? (
          <EmptyState
            icon={ReceiptText}
            title={page > 1 && list.count > 0 ? "No fees on this page" : filtered ? "No fees match these filters" : filters.outstanding ? "Nothing outstanding" : "No fees for this billing month"}
            description={filtered ? "Try another status or name." : filters.outstanding ? "Every current fee is fully paid." : "Use Add fee for one charge, or Generate monthly fees for your active students."}
            action={filtered && <Link href={feesHref(base, query, { status: undefined, q: undefined })} className={smallButton}>Clear filters</Link>}
          />
        ) : <>
          <p className="mb-3 text-[0.8125rem] text-slate-500" aria-live="polite">{list.count} {list.count === 1 ? "fee" : "fees"}</p>
          <FeeList rows={list.rows} today={today} base={base} listQuery={listQuery} branches={branchInfo} showBranch={showBranch} />
          {pages > 1 || page > 1 ? <Pagination page={page} pages={Math.max(pages, page)} previousHref={page > 1 ? feesHref(base, query, { page: String(page - 1) }) : undefined} nextHref={page < pages ? feesHref(base, query, { page: String(page + 1) }) : undefined} /> : null}
        </>}
    </section>

    {feeId && (
      <FeeModal closeHref={closeHref}>
        {!detail?.ok ? <><h2 id="fee-modal-title" className="pr-12 text-[1.375rem]! sm:text-2xl!">Fee unavailable</h2><p role="alert" className="mt-3 text-sm text-slate-600">We couldn&apos;t load this fee. Reload the page to try again.</p></>
          // Narrow on `detail.fee` (null for a missing fee): `"student" in detail` didn't narrow, because
          // TypeScript gives the not-found shape optional `student?: undefined` / `history?: undefined`.
          : !fee || !detail.fee ? <><h2 id="fee-modal-title" className="pr-12 text-[1.375rem]! sm:text-2xl!">Fee not found</h2><p className="mt-3 text-sm text-slate-600">It may belong to another club or no longer exist.</p></>
          : (() => {
            const student = detail.student;
            const history = detail.history;
            const voided = !!fee.voided_at;
            const status = voided ? "voided" : fee.balance_sen <= 0 ? "paid" : fee.paid_sen > 0 ? "partial" : "unpaid";
            const canPay = !voided && fee.balance_sen > 0;
            const canVoid = !voided && fee.paid_sen === 0;
            const detailsHref = feeHref(fee.id);
            const allocationId = typeof sp.allocation === "string" && idSchema.safeParse(sp.allocation).success ? sp.allocation : "";
            const allocation = history.find((a) => a.id === allocationId && !a.reversed_at);
            const backLink = <Link href={detailsHref} scroll={false} className="mb-4 inline-flex items-center gap-1.5 rounded-lg text-sm font-semibold text-slate-600 hover:text-foreground"><ArrowLeft size={16} aria-hidden /> Back to fee details</Link>;
            const amounts = (
              <dl className="grid grid-cols-3 overflow-hidden rounded-xl text-sm ring-1 ring-inset ring-border">
                <div className="min-w-0 px-3 py-2.5 sm:px-4"><dt className="text-xs text-slate-500">Charged</dt><dd className="mt-0.5 break-words font-semibold tabular-nums">{money(fee.amount_sen)}</dd></div>
                <div className="min-w-0 border-l border-border px-3 py-2.5 sm:px-4"><dt className="text-xs text-slate-500">Paid</dt><dd className="mt-0.5 break-words font-semibold tabular-nums">{money(fee.paid_sen)}</dd></div>
                {/* The remaining balance is the figure to act on, so it's the highlighted cell. */}
                <div className="min-w-0 bg-navy px-3 py-2.5 text-white sm:px-4"><dt className="text-xs text-white/70">Balance</dt><dd className="mt-0.5 break-words text-[0.9375rem] font-semibold tabular-nums">{money(fee.balance_sen)}</dd></div>
              </dl>
            );
            const notice = typeof sp.notice === "string" ? notices[sp.notice] : undefined;
            return <>
              <h2 id="fee-modal-title" className="break-words pr-12 text-[1.375rem]! leading-tight tracking-[-0.025em]! sm:text-2xl!">{fee.title}</h2>
              <p className="mt-1.5 text-sm text-slate-600">
                <Link href={`/clubs/${club.id}/students/${student.id}`} className="font-semibold text-primary hover:underline">{student.full_name}</Link>
                {student.archived_at ? " (archived)" : ""} · {branchName(fee.branch_id)}
              </p>
              {notice && <SuccessNote className="mt-4">{notice}</SuccessNote>}
              <div className="mt-5">
                {action === "pay" && canPay ? <>
                  {backLink}
                  <h3 className="mb-3 text-[0.9375rem] font-bold">Record payment</h3>
                  <div className="mb-5">{amounts}</div>
                  <PaymentForm action={recordFeePayment.bind(null, club.id, fee.id, returnQuery)} balanceSen={fee.balance_sen} today={today} cancelHref={detailsHref} methods={settings.paymentMethods} />
                </> : action === "link" && canPay ? <>
                  {backLink}
                  <h3 className="mb-3 text-[0.9375rem] font-bold">Link existing income</h3>
                  <div className="mb-4">{amounts}</div>
                  <form action={base} role="search" className="mb-4 flex gap-2">
                    {Object.entries(listQuery).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
                    <input type="hidden" name="fee" value={fee.id} /><input type="hidden" name="action" value="link" />
                    <label htmlFor="receipt-search" className="sr-only">Search receipts</label>
                    <SearchInput id="receipt-search" name="rq" defaultValue={searchTerm(sp.rq)} maxLength={80} placeholder="Search receipt descriptions" className="flex-1" />
                    <Button type="submit" variant="outline" className="shrink-0">Search</Button>
                  </form>
                  {receipts === null ? <p role="alert" className="text-sm text-slate-600">Unable to load Finance receipts. Reload to try again.</p>
                    : receipts.length === 0 ? <p className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600 ring-1 ring-inset ring-border">No Finance receipts with an unallocated amount{searchTerm(sp.rq) ? " match this search" : ""}. Use Record payment for money not yet in Finance.</p>
                    : <LinkReceiptForm action={linkFeeReceipt.bind(null, club.id, fee.id, returnQuery)} balanceSen={fee.balance_sen} cancelHref={detailsHref}
                        receipts={receipts.map((r) => ({ id: r.id, label: r.description, detail: `${formatDate(r.occurred_on)} · ${branchName(r.branch_id)} · ${categoryLabel("income", r.category, categories)} · ${money(r.amount_sen)} received`, availableSen: Number(r.available_sen), mismatch: (r.branch_id ?? null) !== (fee.branch_id ?? null) }))} />}
                </> : action === "edit" && !voided ? <>
                  {backLink}
                  <h3 className="mb-3 text-[0.9375rem] font-bold">Edit fee</h3>
                  <EditFeeForm action={editFee.bind(null, club.id, fee.id, returnQuery)} branches={activeBranches} today={today} fee={fee} locked={fee.paid_sen > 0} branchName={fee.branch_id ? branchName(fee.branch_id) : undefined} />
                </> : action === "void" && canVoid ? <>
                  {backLink}
                  <h3 className="mb-2 text-[0.9375rem] font-bold">Void this fee?</h3>
                  <p className="mb-4 text-sm text-slate-600">The fee stops counting towards totals and can&apos;t be paid. It isn&apos;t deleted and stays under the Voided filter with your reason.</p>
                  <ReasonForm action={voidFee.bind(null, club.id, fee.id, returnQuery)} submit="Void fee" danger label="Reason" hint="For example: charged by mistake." cancelHref={detailsHref} />
                </> : action === "reverse" && allocation ? <>
                  {backLink}
                  <h3 className="mb-2 text-[0.9375rem] font-bold">Remove this allocation?</h3>
                  <p className="mb-4 text-sm text-slate-600">This removes the link of {money(allocation.amount_sen)} from this fee only, reopening its balance. The Finance receipt stays as recorded income; this is not a refund. The removal is kept in the payment history.</p>
                  <ReasonForm action={reverseAllocation.bind(null, club.id, fee.id, allocation.id, returnQuery)} submit="Remove allocation" danger label="Reason" hint="For example: linked to the wrong student." cancelHref={detailsHref} />
                </> : <>
                  {amounts}
                  <dl className="mt-5 grid gap-x-6 gap-y-4 text-sm sm:grid-cols-2">
                    <div><dt className="text-[0.8125rem] text-slate-500">Status</dt><dd className="mt-1"><FeeStatusPill fee={{ status, balance_sen: fee.balance_sen, due_date: fee.due_date }} today={today} /></dd></div>
                    <div><dt className="text-[0.8125rem] text-slate-500">Fee type</dt><dd className="mt-1 font-medium">{feeTypeLabel(fee.fee_type)}</dd></div>
                    <div><dt className="text-[0.8125rem] text-slate-500">Billing period</dt><dd className="mt-1 font-medium">{fee.fee_type === "yearly" ? fee.billing_month.slice(0, 4) : billingMonthLabel(fee.billing_month)}</dd></div>
                    <div><dt className="text-[0.8125rem] text-slate-500">Due date</dt><dd className="mt-1 font-medium">{formatDate(fee.due_date)}</dd></div>
                    <div><dt className="text-[0.8125rem] text-slate-500">Branch</dt><dd className="mt-1 font-medium">{branchName(fee.branch_id)}</dd></div>
                    <div><dt className="text-[0.8125rem] text-slate-500">Created</dt><dd className="mt-1 font-medium">{recordedAt.format(new Date(fee.created_at))}{fee.updated_at ? ` · edited ${recordedAt.format(new Date(fee.updated_at))}` : ""}</dd></div>
                    {fee.notes && <div className="sm:col-span-2"><dt className="text-[0.8125rem] text-slate-500">Notes</dt><dd className="mt-1 whitespace-pre-line break-words">{fee.notes}</dd></div>}
                    {voided && <div className="sm:col-span-2"><dt className="text-[0.8125rem] text-slate-500">Voided</dt><dd className="mt-1 break-words">{recordedAt.format(new Date(fee.voided_at!))} · {fee.void_reason}</dd></div>}
                  </dl>

                  <h3 className="mb-2.5 mt-7 text-[0.9375rem] font-bold">Payment history</h3>
                  {history.length === 0 ? <p className="text-sm text-slate-600">No payments yet.</p> : (
                    <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border">
                      {history.map((a) => (
                        <li key={a.id} className={cn("px-4 py-3 text-sm", a.reversed_at && "bg-slate-50")}>
                          <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
                            <span className={cn("font-semibold tabular-nums", a.reversed_at && "text-slate-500 line-through")}>{money(a.amount_sen)}</span>
                            <span className="text-slate-600">{a.receipt ? formatDate(a.receipt.occurred_on) : "—"} · {a.source === "fee_payment" ? methodLabel(a.method) : "Linked Finance receipt"}</span>
                          </div>
                          {a.reference && <p className="mt-1 break-words text-slate-600">Reference: {a.reference}</p>}
                          {a.notes && <p className="mt-1 break-words text-slate-600">{a.notes}</p>}
                          {a.receipt && <p className="mt-1 break-words text-xs text-slate-500">Finance receipt: <Link href={`/clubs/${club.id}/finances?date=${a.receipt.occurred_on}`} className="font-semibold text-primary hover:underline">{a.receipt.description}</Link>{(a.receipt.branch_id ?? null) !== (fee.branch_id ?? null) ? ` · recorded under ${branchName(a.receipt.branch_id)} (different branch)` : ""}</p>}
                          {a.reversed_at ? <p className="mt-1 text-xs font-semibold text-slate-600">Allocation removed {recordedAt.format(new Date(a.reversed_at))}: {a.reversal_reason}</p>
                            : !voided && <Link href={feesHref(base, listQuery, { fee: fee.id, action: "reverse", allocation: a.id })} scroll={false} className="mt-2 inline-block text-xs font-semibold text-red-700 hover:underline">Remove allocation</Link>}
                        </li>
                      ))}
                    </ul>
                  )}

                  {/* Primary actions as buttons; Edit and Void in the ⋯ menu. */}
                  <div className="mt-7 flex flex-wrap items-center gap-2.5 border-t border-border pt-5">
                    {canPay && <Link href={feeHref(fee.id, "pay")} scroll={false} className={buttonVariants()}>Record payment</Link>}
                    {canPay && <Link href={feeHref(fee.id, "link")} scroll={false} className={buttonVariants({ variant: "outline" })}>Link existing income</Link>}
                    <div className="ml-auto">
                      <FeeActionsMenu label={`More actions for ${fee.title}`} items={[
                        ...(!voided ? [{ label: "Edit fee", href: feeHref(fee.id, "edit") }] : []),
                        ...(canVoid ? [{ label: "Void fee", href: feeHref(fee.id, "void"), danger: true }] : []),
                      ]} />
                    </div>
                  </div>
                  {!voided && fee.paid_sen > 0 && <p className="mt-3 text-xs text-slate-500">Fees with payments can&apos;t be voided or change amount. Remove wrong allocations first.</p>}
                </>}
              </div>
            </>;
          })()}
      </FeeModal>
    )}
  </>;
}
