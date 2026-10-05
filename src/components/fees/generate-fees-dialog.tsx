"use client";
import { useId, useState, useTransition } from "react";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormDialog, ModalSteps, useFormDialog } from "@/components/form-dialog";
import { monthOptions } from "@/components/fees/add-fee-dialog";
import { amountSchema, formatMYR } from "@/lib/finance/values";
import { billingMonthLabel } from "@/lib/fees/values";
import type { GenerateResult, PreviewResult, PreviewStudent } from "@/app/clubs/[clubId]/fees/actions";
import { cn } from "@/lib/utils";

type Branch = { id: string; name: string };
type Row = PreviewStudent & { include: boolean; amount: string };
const ZERO = BigInt(0);
const STEPS = ["Billing settings", "Students and confirm"];
const stickyBar = "sticky bottom-0 z-10 -mx-5 -mb-5 flex flex-col gap-3 border-t border-border bg-white px-5 py-4 sm:-mx-7 sm:-mb-7 sm:flex-row sm:items-center sm:justify-between sm:px-7";
const toSen = (text: string) => { const parsed = amountSchema.safeParse(text); return parsed.success ? parsed.data : null; };
const ringgit = (sen: number) => `${Math.floor(sen / 100)}.${String(sen % 100).padStart(2, "0")}`;
/** Club defaults from Settings → Fees & Payments; they only prefill this form. */
type Defaults = { amountSen: number | null; dueDay: number | null };
/**
 * Prefilled due date for a billing month: the club's due day (clamped to the month's last day),
 * else the 1st as before; never before today, as before.
 */
function defaultDue(month: string, today: string, dueDay: number | null) {
  const last = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0)).getUTCDate();
  const date = `${month}-${String(Math.min(dueDay ?? 1, last)).padStart(2, "0")}`;
  return date < today ? today : date;
}

/**
 * "Generate monthly fees": a manual preview-and-confirm flow. Step 1 picks the billing month,
 * branch, default amount and due date; step 2 lists eligible active students (already-charged
 * ones shown as skipped) where students can be excluded or given another amount. Only confirming
 * saves; the database skips anyone already charged for the month (also on retries).
 */
export function GenerateFeesDialog({ preview, generate, branches, today, month, branchId, defaults = { amountSen: null, dueDay: null } }: { preview: (input: { month: string; branch_id: string }) => Promise<PreviewResult>; generate: (input: unknown) => Promise<GenerateResult>; branches: Branch[]; today: string; month: string; branchId: string; defaults?: Defaults }) {
  return (
    <FormDialog label="Generate monthly fees" title="Generate monthly fees" description="Review the students before any fee is created." modalClassName="sm:max-w-3xl" trigger={{ variant: "outline", icon: "none" }} noticeParams={() => ({})}>
      <GenerateFlow preview={preview} generate={generate} branches={branches} today={today} month={month} branchId={branchId} defaults={defaults} />
    </FormDialog>
  );
}

function GenerateFlow({ preview, generate, branches, today, month: initialMonth, branchId, defaults }: { preview: (input: { month: string; branch_id: string }) => Promise<PreviewResult>; generate: (input: unknown) => Promise<GenerateResult>; branches: Branch[]; today: string; month: string; branchId: string; defaults: Defaults }) {
  const id = useId();
  const { close, onSaved } = useFormDialog();
  const [pending, startTransition] = useTransition();
  const [month, setMonth] = useState(initialMonth);
  const [branch, setBranch] = useState(branches.some((b) => b.id === branchId) ? branchId : "");
  const [title, setTitle] = useState("");
  // Both stay editable; the defaults only fill them in.
  const [amount, setAmount] = useState(defaults.amountSen ? ringgit(defaults.amountSen) : "");
  const [due, setDue] = useState(defaultDue(initialMonth, today, defaults.dueDay));
  const [dueEdited, setDueEdited] = useState(false);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState("");
  const defaultTitle = `Monthly training fee · ${billingMonthLabel(month)}`;
  const branchName = (bid: string | null) => (bid ? branches.find((b) => b.id === bid)?.name ?? "Branch" : "Club-level");

  function runPreview(event: React.FormEvent) {
    event.preventDefault();
    if (toSen(amount) === null) return setError("Enter a default amount from RM0.01, with at most two decimal places.");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(due)) return setError("Choose a due date.");
    setError("");
    startTransition(async () => {
      const result = await preview({ month, branch_id: branch });
      if (!result.ok) return setError(result.error);
      setRows(result.students.map((s) => ({ ...s, include: !s.charged, amount })));
    });
  }

  const chosen = (rows ?? []).filter((r) => r.include && !r.charged);
  const invalid = chosen.filter((r) => toSen(r.amount) === null);
  const total = chosen.reduce((sum, r) => sum + BigInt(toSen(r.amount) ?? 0), ZERO);

  function confirm() {
    if (!chosen.length || invalid.length) return;
    setError("");
    startTransition(async () => {
      const result = await generate({ month, due_date: due, title: title.trim() || defaultTitle, items: chosen.map((r) => ({ student_id: r.id, amount_sen: toSen(r.amount) })) });
      if (!result.ok) return setError(result.error);
      onSaved(result.created, { notice: "generated", created: String(result.created), skipped: String(result.skipped + result.ineligible), page: "" });
    });
  }
  const update = (rowId: string, change: Partial<Row>) => setRows((list) => list?.map((r) => (r.id === rowId ? { ...r, ...change } : r)) ?? null);

  if (!rows) {
    return (
      <form onSubmit={runPreview} className="space-y-5" aria-busy={pending}>
        <ModalSteps steps={STEPS} current={0} />
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor={`${id}-month`}>Billing month</label>
            <select id={`${id}-month`} className="field-select mt-1.5" value={month} onChange={(e) => { setMonth(e.target.value); if (defaults.dueDay && !dueEdited) setDue(defaultDue(e.target.value, today, defaults.dueDay)); }}>
              {monthOptions(today, month).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor={`${id}-branch`}>Branch</label>
            <select id={`${id}-branch`} className="field-select mt-1.5" value={branch} onChange={(e) => setBranch(e.target.value)}>
              <option value="">All branches</option>
              {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor={`${id}-amount`}>Default monthly fee (MYR)</label>
            <Input id={`${id}-amount`} className="mt-1.5" inputMode="decimal" placeholder="0.00" maxLength={12} value={amount} onChange={(e) => setAmount(e.target.value)} required />
            {(defaults.amountSen || defaults.dueDay) && <p className="mt-1.5 text-xs text-slate-500">Prefilled from Settings → Fees &amp; Payments. Change it here if needed.</p>}
          </div>
          <div>
            <label htmlFor={`${id}-due`}>Due date</label>
            <Input id={`${id}-due`} className="mt-1.5" type="date" min="1900-01-01" value={due} onChange={(e) => { setDue(e.target.value); setDueEdited(true); }} required />
          </div>
        </div>
        <div>
          <label htmlFor={`${id}-title`}>Title</label>
          <Input id={`${id}-title`} className="mt-1.5" maxLength={120} value={title} placeholder={defaultTitle} onChange={(e) => setTitle(e.target.value)} />
          <p className="mt-1.5 text-xs text-slate-500">Leave blank to use “{defaultTitle}”.</p>
        </div>
        <p className="rounded-xl bg-slate-50 px-4 py-3 text-[0.8125rem] leading-5 text-slate-600 ring-1 ring-inset ring-border">Only active students on current branches are listed. Pending registrations aren&apos;t charged, and there&apos;s no proration.</p>
        {error && <p role="alert" className="rounded-xl border border-red-200/70 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>}
        <div className="flex flex-col-reverse gap-2.5 pt-1 sm:flex-row sm:justify-end">
          <Button type="button" variant="ghost" onClick={close}>Cancel</Button>
          <Button type="submit" disabled={pending}>{pending ? <><Loader2 size={16} aria-hidden className="animate-spin motion-reduce:animate-none" /> Loading…</> : "Preview students"}</Button>
        </div>
      </form>
    );
  }

  const skipped = rows.filter((r) => r.charged).length;
  return (
    <div className="space-y-5" aria-busy={pending}>
      <ModalSteps steps={STEPS} current={1} />
      <div className="-mt-2 flex flex-wrap items-center justify-between gap-3">
        <button type="button" onClick={() => { setRows(null); setError(""); }} className="inline-flex items-center gap-1.5 rounded-lg text-sm font-semibold text-slate-600 hover:text-foreground focus-visible:outline-2 focus-visible:outline-primary"><ArrowLeft size={16} aria-hidden /> Change settings</button>
        <p className="text-[0.8125rem] text-slate-500">{billingMonthLabel(month)} · {branch ? branchName(branch) : "All branches"} · due {due}</p>
      </div>
      {rows.length === 0 ? <p className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600 ring-1 ring-inset ring-border">No active students match. Choose another branch or add students first.</p> : (
        <ul aria-label="Students to charge" className="max-h-[45dvh] overflow-y-auto overscroll-contain rounded-xl border border-border">
          {rows.map((r) => {
            const bad = r.include && !r.charged && toSen(r.amount) === null;
            return (
              <li key={r.id} className={cn("flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-border px-4 py-3 last:border-b-0", r.charged ? "bg-slate-50" : r.include && "bg-primary/[0.03]")}>
                <label className="flex min-w-0 flex-1 items-center gap-3 font-normal">
                  <input type="checkbox" className="size-5 shrink-0 accent-[var(--primary)]" checked={r.include && !r.charged} disabled={r.charged} onChange={(e) => update(r.id, { include: e.target.checked })} />
                  <span className="min-w-0">
                    <span className="block break-words font-semibold">{r.name}</span>
                    <span className="block text-xs text-slate-500">{branchName(r.branch_id)}{r.charged ? " · Already charged for this month — skipped" : ""}</span>
                  </span>
                </label>
                {!r.charged && (
                  <div className="w-32 shrink-0">
                    <label htmlFor={`${id}-a-${r.id}`} className="sr-only">Amount for {r.name} (MYR)</label>
                    <Input id={`${id}-a-${r.id}`} inputMode="decimal" maxLength={12} value={r.amount} disabled={!r.include} aria-invalid={bad} onChange={(e) => update(r.id, { amount: e.target.value })} className="h-9 text-right tabular-nums" />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {error && <p role="alert" className="rounded-xl border border-red-200/70 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>}
      <div className={stickyBar}>
        <div className="text-sm" aria-live="polite">
          <p><span className="font-semibold">{chosen.length} {chosen.length === 1 ? "student" : "students"}</span> · total <span className="font-semibold tabular-nums">{formatMYR(total.toString())}</span>{skipped ? <span className="text-slate-500"> · {skipped} already charged (skipped)</span> : ""}</p>
          {invalid.length > 0 && <p className="mt-1 text-red-700">Fix the amount for {invalid.length} {invalid.length === 1 ? "student" : "students"} (RM0.01 or more, at most two decimals).</p>}
        </div>
        <div className="flex flex-col-reverse gap-2.5 sm:flex-row">
          <Button type="button" variant="ghost" onClick={close}>Cancel</Button>
          <Button type="button" onClick={confirm} disabled={pending || !chosen.length || invalid.length > 0}>{pending ? "Creating…" : `Create ${chosen.length} ${chosen.length === 1 ? "fee" : "fees"}`}</Button>
        </div>
      </div>
    </div>
  );
}
