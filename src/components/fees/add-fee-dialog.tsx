"use client";
import { useId, useMemo, useState, useTransition } from "react";
import { ArrowLeft } from "lucide-react";
import { ActionForm, type FormAction } from "@/components/action-form";
import { SelectField, TextAreaField, TextField } from "@/components/field";
import { Button } from "@/components/ui/button";
import { Input, SearchInput } from "@/components/ui/input";
import { FormDialog, ModalSteps, useFormDialog } from "@/components/form-dialog";
import { BeltSwatch } from "@/components/belt-swatch";
import { newRequestId } from "@/components/finance/transaction-form";
import { amountSchema, formatMYR } from "@/lib/finance/values";
import { FEE_TYPES, ONE_OFF_FEE_TYPES, billingMonthLabel, feeEditSchema, feeTypeLabel, shiftMonth } from "@/lib/fees/values";
import type { BatchResult } from "@/app/clubs/[clubId]/fees/actions";
import { cn } from "@/lib/utils";

type Branch = { id: string; name: string };
export type FeeStudent = { id: string; full_name: string; branch_id: string | null; belt: { name: string; color: string; stripe: string | null } | null };

/** Billing month choices: a year back to six months ahead, plus `include` if outside that window. */
export function monthOptions(today: string, include?: string) {
  const months = Array.from({ length: 19 }, (_, i) => shiftMonth(today.slice(0, 7), 6 - i));
  if (include && !months.includes(include)) months.push(include);
  return months.sort((a, b) => b.localeCompare(a)).map((m) => ({ value: m, label: billingMonthLabel(m) }));
}

const PAGE_SIZE = 20;
const STEPS = ["Fee details and students", "Review"];
/** Sticky action bar at the bottom of the scrolling modal: summary on the left, actions on the right. */
const stickyBar = "sticky bottom-0 z-10 -mx-5 -mb-5 flex flex-col gap-3 border-t border-border bg-white px-5 py-4 sm:-mx-7 sm:-mb-7 sm:flex-row sm:items-center sm:justify-between sm:px-7";
const ZERO = BigInt(0);
const toSen = (text: string) => { const parsed = amountSchema.safeParse(text); return parsed.success ? parsed.data : null; };

/**
 * "Add fee": one-off charges (yearly, registration, grading, uniform, event, other) for one or more
 * students. Step 1 sets the fee details and selects students (branch filter, name search,
 * per-student amounts); step 2 reviews and confirms. Each student gets a separate fee, created
 * together in one transaction; nothing recurs. Monthly fees stay with Generate monthly fees.
 */
export function AddFeeDialog({ create, students, branches, today, month, branchId }: { create: (input: unknown) => Promise<BatchResult>; students: FeeStudent[]; branches: Branch[]; today: string; month: string; branchId: string }) {
  return (
    <FormDialog label="Add fee" title="Add a one-off fee" description="Charge one or more students. Payments are recorded separately." modalClassName="sm:max-w-4xl" noticeParams={() => ({})}>
      <AddFeeFlow create={create} students={students} branches={branches} today={today} month={month} branchId={branchId} />
    </FormDialog>
  );
}

function AddFeeFlow({ create, students, branches, today, month: initialMonth, branchId }: { create: (input: unknown) => Promise<BatchResult>; students: FeeStudent[]; branches: Branch[]; today: string; month: string; branchId: string }) {
  const id = useId();
  const { close, onSaved } = useFormDialog();
  const [pending, startTransition] = useTransition();
  // One batch id per opening of the modal: retries and repeated clicks return the same fees.
  const [batchId] = useState(newRequestId);
  const [step, setStep] = useState<"select" | "review">("select");
  const [error, setError] = useState("");
  // Fee details.
  const [feeType, setFeeType] = useState("");
  const [title, setTitle] = useState("");
  const [month, setMonth] = useState(initialMonth);
  const [due, setDue] = useState(today);
  const [defaultAmount, setDefaultAmount] = useState("");
  const [notes, setNotes] = useState("");
  // Selection: present = selected; `amount` set only when edited by hand (otherwise the default applies).
  const [picks, setPicks] = useState<Record<string, { amount?: string }>>({});
  const [branch, setBranch] = useState(branches.some((b) => b.id === branchId) ? branchId : "");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const branchName = (bid: string | null) => (bid ? branches.find((b) => b.id === bid)?.name ?? "Branch" : "Club-level");
  const matching = useMemo(() => {
    const q = search.trim().toLowerCase();
    return students.filter((s) => (!branch || s.branch_id === branch) && (!q || s.full_name.toLowerCase().includes(q)));
  }, [students, branch, search]);
  const pages = Math.max(1, Math.ceil(matching.length / PAGE_SIZE));
  const currentPage = Math.min(page, pages);
  const visible = matching.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const selected = students.filter((s) => picks[s.id]);
  const amountOf = (sid: string) => picks[sid]?.amount ?? defaultAmount;
  const invalid = selected.filter((s) => toSen(amountOf(s.id)) === null);
  const total = selected.reduce((sum, s) => sum + BigInt(toSen(amountOf(s.id)) ?? 0), ZERO);
  const customCount = selected.filter((s) => picks[s.id]?.amount !== undefined).length;
  const unselectedMatching = matching.filter((s) => !picks[s.id]).length;

  const toggle = (sid: string, on: boolean) => setPicks((p) => { const next = { ...p }; if (on) next[sid] = p[sid] ?? {}; else delete next[sid]; return next; });
  const selectAllMatching = () => setPicks((p) => { const next = { ...p }; for (const s of matching) next[s.id] = p[s.id] ?? {}; return next; });
  const setAmount = (sid: string, amount: string) => setPicks((p) => ({ ...p, [sid]: { amount } }));
  const applyDefault = () => setPicks((p) => Object.fromEntries(Object.keys(p).map((k) => [k, {}])));

  function review(event: React.FormEvent) {
    event.preventDefault();
    const problem = !feeType ? "Choose a fee type."
      : title.trim().length < 2 ? "Enter a fee title (at least 2 characters)."
      : !/^\d{4}-\d{2}-\d{2}$/.test(due) ? "Choose a due date."
      : toSen(defaultAmount) === null ? "Enter a default amount from RM0.01, with at most two decimal places."
      : selected.length === 0 ? "Select at least one student."
      : selected.length > 500 ? "Select at most 500 students at a time."
      : invalid.length ? `Fix the amount for ${invalid.length} selected ${invalid.length === 1 ? "student" : "students"}.`
      : "";
    setError(problem);
    if (!problem) setStep("review");
  }

  function confirm() {
    setError("");
    startTransition(async () => {
      const result = await create({ batch_id: batchId, fee_type: feeType, title: title.trim(), billing_month: month, due_date: due, notes: notes.trim(), items: selected.map((s) => ({ student_id: s.id, amount_sen: toSen(amountOf(s.id)) })) });
      // On failure everything stays as entered (nothing was saved: the batch is all or nothing).
      if (!result.ok) return setError(result.error);
      onSaved(result.created, { notice: "fees-added", created: String(result.created), page: "" });
    });
  }

  const typeLabel = feeType ? feeTypeLabel(feeType) : "";

  if (step === "review") {
    return (
      <div className="space-y-5" aria-busy={pending}>
        <ModalSteps steps={STEPS} current={1} />
        <button type="button" onClick={() => { setStep("select"); setError(""); }} className="-mt-2 inline-flex items-center gap-1.5 rounded-lg text-sm font-semibold text-slate-600 hover:text-foreground focus-visible:outline-2 focus-visible:outline-primary"><ArrowLeft size={16} aria-hidden /> Back to details and students</button>
        <dl className="grid gap-x-6 gap-y-3 rounded-xl bg-slate-50 p-4 text-sm ring-1 ring-inset ring-border sm:grid-cols-2">
          <div className="min-w-0"><dt className="text-xs text-slate-500">Fee</dt><dd className="mt-0.5 break-words font-semibold">{title.trim()}</dd></div>
          <div><dt className="text-xs text-slate-500">Type</dt><dd className="mt-0.5 font-medium">{typeLabel}</dd></div>
          <div><dt className="text-xs text-slate-500">Billing period</dt><dd className="mt-0.5 font-medium">{billingMonthLabel(month)}</dd></div>
          <div><dt className="text-xs text-slate-500">Due date</dt><dd className="mt-0.5 font-medium">{due}</dd></div>
          {notes.trim() && <div className="min-w-0 sm:col-span-2"><dt className="text-xs text-slate-500">Notes</dt><dd className="mt-0.5 whitespace-pre-line break-words">{notes.trim()}</dd></div>}
        </dl>
        <ul aria-label="Students to charge" className="max-h-[40dvh] overflow-y-auto overscroll-contain rounded-xl border border-border">
          {selected.map((s) => (
            <li key={s.id} className="flex items-center justify-between gap-3 border-b border-border px-4 py-2.5 text-sm last:border-b-0">
              <span className="min-w-0"><span className="block break-words font-semibold">{s.full_name}</span><span className="block text-xs text-slate-500">{branchName(s.branch_id)}</span></span>
              <span className="shrink-0 font-semibold tabular-nums">{formatMYR(String(toSen(amountOf(s.id)) ?? 0))}</span>
            </li>
          ))}
        </ul>
        <p className="text-[0.8125rem] leading-5 text-slate-600">Each selected student receives a separate fee. No recurring charges are scheduled, and nothing is added to Finance until a payment is recorded.</p>
        {error && <p role="alert" className="rounded-xl border border-red-200/70 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>}
        <div className={stickyBar}>
          <p className="text-sm"><span className="font-semibold">{selected.length} {selected.length === 1 ? "student" : "students"}</span> · total <span className="font-semibold tabular-nums">{formatMYR(total.toString())}</span></p>
          <div className="flex flex-col-reverse gap-2.5 sm:flex-row">
            <Button type="button" variant="ghost" onClick={close}>Cancel</Button>
            <Button type="button" onClick={confirm} disabled={pending}>{pending ? "Creating…" : `Create fees for ${selected.length} ${selected.length === 1 ? "student" : "students"}`}</Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={review} className="space-y-6" noValidate>
      <ModalSteps steps={STEPS} current={0} />
      {/* Fee details */}
      <fieldset className="form-section space-y-5">
        <legend className="form-legend">Fee details</legend>
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor={`${id}-type`}>Fee type</label>
            <select id={`${id}-type`} className="field-select mt-1.5" value={feeType} onChange={(e) => setFeeType(e.target.value)}>
              <option value="">Choose a fee type</option>
              {ONE_OFF_FEE_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
            <p className="mt-1.5 text-xs text-slate-500">One-off charges. Use Generate monthly fees for monthly training fees.</p>
          </div>
          <div>
            <label htmlFor={`${id}-title`}>Fee title</label>
            <Input id={`${id}-title`} className="mt-1.5" maxLength={120} value={title} placeholder="e.g. Grading October 2026" onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div>
            <label htmlFor={`${id}-month`}>Billing period</label>
            <select id={`${id}-month`} className="field-select mt-1.5" value={month} onChange={(e) => setMonth(e.target.value)}>
              {monthOptions(today, month).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor={`${id}-due`}>Due date</label>
            <Input id={`${id}-due`} className="mt-1.5" type="date" min="1900-01-01" value={due} onChange={(e) => setDue(e.target.value)} />
          </div>
          <div>
            <label htmlFor={`${id}-amount`}>Default amount per student (MYR)</label>
            <Input id={`${id}-amount`} className="mt-1.5" inputMode="decimal" placeholder="0.00" maxLength={12} value={defaultAmount} onChange={(e) => setDefaultAmount(e.target.value)} />
            <p className="mt-1.5 text-xs text-slate-500">Used for every selected student unless you change their amount below.</p>
          </div>
          <div>
            <label htmlFor={`${id}-notes`}>Notes (optional)</label>
            <textarea id={`${id}-notes`} className="mt-1.5" rows={2} maxLength={1000} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
      </fieldset>

      {/* Students */}
      <fieldset className="form-section">
        <legend className="form-legend !mb-1">Students</legend>
        <p className="text-[0.8125rem] text-slate-500">Active students of this club only. Selections and amounts are kept while you search, filter or change page.</p>
        <div className="mt-3 grid gap-2.5 sm:grid-cols-[minmax(0,14rem)_minmax(0,1fr)]">
          <div>
            <label htmlFor={`${id}-branch`} className="sr-only">Branch</label>
            <select id={`${id}-branch`} className="field-select" value={branch} onChange={(e) => { setBranch(e.target.value); setPage(1); }}>
              <option value="">All branches</option>
              {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor={`${id}-search`} className="sr-only">Search students by name</label>
            <SearchInput id={`${id}-search`} value={search} maxLength={80} placeholder="Search by name" onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-[0.8125rem]">
          <span className="rounded-full bg-navy px-2.5 py-0.5 text-xs font-semibold text-white tabular-nums" aria-live="polite">{selected.length} selected</span>
          <button type="button" onClick={selectAllMatching} disabled={unselectedMatching === 0} className="font-semibold text-primary hover:underline disabled:text-slate-400 disabled:no-underline">
            Select all {matching.length} matching {matching.length === 1 ? "student" : "students"}{branch || search.trim() ? " (current filter, all pages)" : " (all pages)"}
          </button>
          <button type="button" onClick={() => setPicks({})} disabled={selected.length === 0} className="font-semibold text-slate-600 hover:underline disabled:text-slate-400 disabled:no-underline">Clear selection</button>
          {customCount > 0 && <button type="button" onClick={applyDefault} className="font-semibold text-slate-600 hover:underline">Use the default amount for all {customCount} edited</button>}
        </div>

        {students.length === 0 ? <p className="mt-3 rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600 ring-1 ring-inset ring-border">There are no active students to charge. Add or reactivate a student first.</p>
          : matching.length === 0 ? <p className="mt-3 rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600 ring-1 ring-inset ring-border">No active students match this branch and search.</p>
          : <>
            {/* Desktop: table */}
            <div className="mt-3 hidden overflow-x-auto rounded-xl border border-border bg-white md:block">
              <table className="data-table">
                <caption className="sr-only">Students to select, page {currentPage} of {pages}</caption>
                <thead>
                  <tr>
                    <th scope="col" className="w-12 px-4"><span className="sr-only">Select</span></th>
                    <th scope="col" className="px-4 py-3">Student</th>
                    <th scope="col" className="px-4 py-3">Branch</th>
                    <th scope="col" className="px-4 py-3">Belt / level</th>
                    <th scope="col" className="w-40 px-4 py-3 text-right">Amount (MYR)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {visible.map((s) => <StudentRow key={s.id} id={id} student={s} branch={branchName(s.branch_id)} picked={!!picks[s.id]} amount={amountOf(s.id)} custom={picks[s.id]?.amount !== undefined} onToggle={toggle} onAmount={setAmount} layout="row" />)}
                </tbody>
              </table>
            </div>
            {/* Mobile: compact list */}
            <ul aria-label={`Students to select, page ${currentPage} of ${pages}`} className="mt-3 overflow-hidden rounded-xl border border-border bg-white md:hidden">
              {visible.map((s) => <StudentRow key={s.id} id={id} student={s} branch={branchName(s.branch_id)} picked={!!picks[s.id]} amount={amountOf(s.id)} custom={picks[s.id]?.amount !== undefined} onToggle={toggle} onAmount={setAmount} layout="card" />)}
            </ul>
            {pages > 1 && (
              <nav aria-label="Student pages" className="mt-3 flex items-center justify-between gap-3 text-sm">
                <Button type="button" variant="outline" size="sm" onClick={() => setPage(currentPage - 1)} disabled={currentPage <= 1} className="disabled:invisible">← Previous</Button>
                <span className="text-slate-500">Page <span className="font-semibold text-foreground">{currentPage}</span> of {pages} · {matching.length} matching</span>
                <Button type="button" variant="outline" size="sm" onClick={() => setPage(currentPage + 1)} disabled={currentPage >= pages} className="disabled:invisible">Next →</Button>
              </nav>
            )}
          </>}
      </fieldset>

      {error && <p role="alert" className="rounded-xl border border-red-200/70 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>}
      <div className={stickyBar}>
        <p className="text-sm" aria-live="polite">
          <span className="font-semibold">{selected.length} {selected.length === 1 ? "student" : "students"}</span> · total <span className="font-semibold tabular-nums">{formatMYR(total.toString())}</span>
          {invalid.length > 0 && toSen(defaultAmount) !== null && <span className="block text-red-700">Fix the amount for {invalid.length} selected {invalid.length === 1 ? "student" : "students"}.</span>}
        </p>
        <div className="flex flex-col-reverse gap-2.5 sm:flex-row">
          <Button type="button" variant="ghost" onClick={close}>Cancel</Button>
          <Button type="submit">Review {selected.length ? `${selected.length} ${selected.length === 1 ? "fee" : "fees"}` : "fees"}</Button>
        </div>
      </div>
    </form>
  );
}

/** One selectable student: a table row (md+) or a compact card (mobile). */
function StudentRow({ id, student, branch, picked, amount, custom, onToggle, onAmount, layout }: { id: string; student: FeeStudent; branch: string; picked: boolean; amount: string; custom: boolean; onToggle: (sid: string, on: boolean) => void; onAmount: (sid: string, amount: string) => void; layout: "row" | "card" }) {
  const checkboxId = `${id}-${layout}-pick-${student.id}`;
  const bad = picked && amount !== "" && amountSchema.safeParse(amount).success === false;
  const checkbox = <input id={checkboxId} type="checkbox" className="size-5 shrink-0 accent-[var(--primary)]" checked={picked} onChange={(e) => onToggle(student.id, e.target.checked)} />;
  const belt = student.belt ? <span className="inline-flex items-center gap-1.5"><BeltSwatch color={student.belt.color} stripe={student.belt.stripe} /><span className="break-words">{student.belt.name}</span></span> : <span className="text-slate-400">—</span>;
  const amountInput = (
    <span className="block">
      <label htmlFor={`${id}-${layout}-amount-${student.id}`} className="sr-only">Amount for {student.full_name} (MYR)</label>
      <Input id={`${id}-${layout}-amount-${student.id}`} inputMode="decimal" maxLength={12} value={amount} placeholder="0.00" disabled={!picked} aria-invalid={bad} onChange={(e) => onAmount(student.id, e.target.value)} className="h-9 text-right tabular-nums" />
      {custom && picked && <span className="mt-0.5 block text-right text-[11px] text-slate-500">Edited</span>}
    </span>
  );
  if (layout === "row") {
    return (
      <tr className={cn("align-middle hover:bg-slate-50/80", picked && "bg-primary/[0.04] hover:bg-primary/[0.06]")}>
        <td className="px-4 py-2.5">{checkbox}</td>
        <td className="min-w-40 px-4 py-2.5"><label htmlFor={checkboxId} className="cursor-pointer break-words !text-sm font-semibold">{student.full_name}</label></td>
        <td className="min-w-28 break-words px-4 py-2.5 text-slate-600">{branch}</td>
        <td className="min-w-32 px-4 py-2.5 text-slate-600">{belt}</td>
        <td className="px-4 py-2.5">{amountInput}</td>
      </tr>
    );
  }
  return (
    <li className={cn("flex items-center gap-3 border-b border-border px-4 py-3 last:border-b-0", picked && "bg-primary/[0.04]")}>
      {checkbox}
      <label htmlFor={checkboxId} className="min-w-0 flex-1 cursor-pointer font-normal">
        <span className="block break-words text-sm font-semibold">{student.full_name}</span>
        <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-slate-500">{branch}{student.belt && <> · {belt}</>}</span>
      </label>
      <span className="w-28 shrink-0">{amountInput}</span>
    </li>
  );
}

/** Fee fields for Edit fee. `locked` (fee has payments) keeps only non-financial fields. */
function FeeFields({ branches, today, defaults, locked = false, extraBranch }: { branches: Branch[]; today: string; defaults: { branch_id: string; fee_type: string; title: string; billing_month: string; due_date: string; amount: string; notes: string }; locked?: boolean; extraBranch?: { id: string; name: string } }) {
  const branchOptions = [
    { value: "", label: "Club-level (no branch)" },
    ...branches.map((b) => ({ value: b.id, label: b.name })),
    ...(extraBranch && !branches.some((b) => b.id === extraBranch.id) ? [{ value: extraBranch.id, label: extraBranch.name }] : []),
  ];
  return <>
    {!locked && <>
      <SelectField name="branch_id" label="Branch" defaultValue={defaults.branch_id} options={branchOptions} hint="Recorded on the fee and used for its payments, even if the student changes branch later." />
      <div className="grid gap-5 sm:grid-cols-2">
        <SelectField name="fee_type" label="Fee type" defaultValue={defaults.fee_type} options={[{ value: "", label: "Choose a fee type" }, ...FEE_TYPES]} />
        <SelectField name="billing_month" label="Billing period" defaultValue={defaults.billing_month} options={monthOptions(today, defaults.billing_month)} />
      </div>
    </>}
    <TextField name="title" label="Title" defaultValue={defaults.title} maxLength={120} required placeholder="e.g. Grading fee — yellow belt" />
    <div className="grid gap-5 sm:grid-cols-2">
      {!locked && <TextField name="amount" label="Amount (MYR)" defaultValue={defaults.amount} inputMode="decimal" placeholder="0.00" maxLength={12} required />}
      <TextField name="due_date" label="Due date" type="date" defaultValue={defaults.due_date} min="1900-01-01" required hint="Overdue from the next day (Malaysia time)." />
    </div>
    <TextAreaField name="notes" label="Notes (optional)" defaultValue={defaults.notes} maxLength={1000} rows={3} />
  </>;
}

/** Edit fee form (fee details modal). */
export function EditFeeForm({ action, branches, today, fee, locked, branchName }: { action: FormAction; branches: Branch[]; today: string; fee: { branch_id: string | null; fee_type: string; title: string; billing_month: string; due_date: string; amount_sen: number; notes: string | null }; locked: boolean; branchName?: string }) {
  const amount = `${Math.floor(fee.amount_sen / 100)}.${String(fee.amount_sen % 100).padStart(2, "0")}`;
  return (
    <ActionForm action={action} schema={locked ? undefined : feeEditSchema} submit="Save changes">
      {locked && <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900">This fee has payments, so only its title, due date and notes can change. To correct the amount, remove the wrong allocations first.</p>}
      <FeeFields branches={branches} today={today} locked={locked}
        extraBranch={fee.branch_id && branchName ? { id: fee.branch_id, name: `${branchName} (current)` } : undefined}
        defaults={{ branch_id: fee.branch_id ?? "", fee_type: fee.fee_type, title: fee.title, billing_month: fee.billing_month.slice(0, 7), due_date: fee.due_date, amount, notes: fee.notes ?? "" }} />
    </ActionForm>
  );
}
