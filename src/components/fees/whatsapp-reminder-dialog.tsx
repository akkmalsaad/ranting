"use client";
import { useEffect, useId, useRef, useState, useTransition } from "react";
import { CircleCheck, Copy, Info, Loader2, MessageCircle, RotateCcw } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { FormDialog, useFormDialog } from "@/components/form-dialog";
import { BranchSelect } from "@/components/finance/branch-select";
import { MonthPicker } from "@/components/month-picker";
import { monthOptions } from "@/components/fees/add-fee-dialog";
import { formatMYR } from "@/lib/finance/values";
import { billingMonthLabel } from "@/lib/fees/values";
import { feeReminderMessage, whatsappShareUrl } from "@/lib/fees/reminder";
import type { ReminderSummary } from "@/app/clubs/[clubId]/fees/actions";
import { cn } from "@/lib/utils";

type Branch = { id: string; name: string };
type Props = {
  summarize: (input: { branch_id: string; month: string }) => Promise<ReminderSummary>;
  /** The club's current (non-archived) branches. */
  branches: Branch[];
  clubName: string;
  /** Malaysia date (YYYY-MM-DD) for the month picker's "This month". */
  today: string;
  /** Billing month the Fees page is showing (YYYY-MM), the default here. */
  month: string;
  /** The Fees page's branch filter; preselected when it's a current branch. */
  branchId: string;
};

/**
 * "WhatsApp Reminder": a manual, privacy-safe fee reminder for one branch's parent WhatsApp group.
 * The manager picks a current branch and a billing month; Ranting shows only aggregated outstanding
 * fees (students and total), prepares a general Bahasa Melayu message (editable, not saved), and
 * "Open WhatsApp" opens WhatsApp's share link with no recipient. The manager chooses the group and
 * sends it in WhatsApp; Ranting never sends anything and never says it was sent.
 */
export function WhatsAppReminderDialog({ summarize, branches, clubName, today, month, branchId }: Props) {
  return (
    <FormDialog label="WhatsApp Reminder" title="Send WhatsApp Reminder" description="Prepare a fee reminder to share in your branch WhatsApp group." modalClassName="sm:max-w-xl" trigger={{ variant: "outline", icon: "message" }} noticeParams={() => ({})}>
      <ReminderFlow summarize={summarize} branches={branches} clubName={clubName} today={today} month={month} branchId={branchId} />
    </FormDialog>
  );
}

function ReminderFlow({ summarize, branches, clubName, today, month: initialMonth, branchId }: Props) {
  const id = useId();
  const { close } = useFormDialog();
  const [branch, setBranch] = useState(branches.some((b) => b.id === branchId) ? branchId : "");
  const [month, setMonth] = useState(initialMonth);
  const [attempt, setAttempt] = useState(0);
  const [loaded, setLoaded] = useState<{ key: string; result: ReminderSummary } | null>(null);
  const [, startTransition] = useTransition();
  const branchName = branches.find((b) => b.id === branch)?.name ?? "";

  // Recalculate whenever the branch, month or a retry changes. Loading is derived (the result's key
  // differs from the current one), and a slower earlier response can't overwrite a newer one.
  const requestKey = `${branch}|${month}|${attempt}`;
  const latest = useRef(requestKey);
  useEffect(() => {
    latest.current = requestKey;
    if (!branch) return;
    startTransition(async () => {
      let result: ReminderSummary;
      try { result = await summarize({ branch_id: branch, month }); }
      catch { result = { ok: false, error: "Unable to load outstanding fees. Please try again." }; }
      if (latest.current === requestKey) setLoaded({ key: requestKey, result });
    });
  }, [requestKey, branch, month, summarize]);
  const load = loaded?.key === requestKey ? { state: "done" as const, result: loaded.result } : { state: "loading" as const };
  const retry = () => setAttempt((a) => a + 1);

  // The draft follows the branch and month; edits apply to this draft only (nothing is saved).
  const draftKey = `${branch}|${month}`;
  const generated = branch ? feeReminderMessage({ clubName, branchName, month }) : "";
  const [draft, setDraft] = useState<{ key: string; text: string } | null>(null);
  const text = draft?.key === draftKey ? draft.text : generated;
  const edited = draft?.key === draftKey && draft.text !== generated;

  const summary = load.state === "done" && load.result.ok ? load.result : null;
  const hasOutstanding = !!summary && BigInt(summary.outstandingSen) > BigInt(0);
  const canOpen = hasOutstanding && text.trim().length > 0;

  const [copied, setCopied] = useState<"" | "copied" | "manual">("");
  const messageRef = useRef<HTMLTextAreaElement>(null);
  async function copy() {
    try { await navigator.clipboard.writeText(text); setCopied("copied"); }
    catch { messageRef.current?.select(); setCopied("manual"); }
  }

  const thisYear = Number(today.slice(0, 4));
  const branchOptions = [{ value: "", label: "Select branch" }, ...branches.map((b) => ({ value: b.id, label: b.name }))];

  if (branches.length === 0) {
    return (
      <div>
        <p className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600 ring-1 ring-inset ring-border">Add a branch first. Reminders are prepared for one branch&apos;s WhatsApp group at a time.</p>
        <div className="mt-6 flex justify-end"><Button type="button" variant="ghost" onClick={close}>Close</Button></div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <BranchSelect name="reminder_branch" label="Branch" options={branchOptions} defaultValue={branch} onValueChange={setBranch} />
        <MonthPicker name="reminder_month" label="Billing period" value={month} today={today} fallback={monthOptions(today, month)}
          minYear={Math.min(Number(month.slice(0, 4)), thisYear - 10)} maxYear={Math.max(Number(month.slice(0, 4)), thisYear + 1)} onChange={setMonth} />
      </div>

      {/* Aggregated outstanding fees only: never names or individual balances. */}
      <section aria-labelledby={`${id}-summary`} aria-live="polite" className="rounded-xl bg-slate-50 p-4 ring-1 ring-inset ring-border">
        <h3 id={`${id}-summary`} className="text-[0.8125rem] font-semibold text-slate-600">Outstanding fees · {billingMonthLabel(month)}</h3>
        {!branch ? <p className="mt-1.5 text-sm text-slate-600">Choose a branch to see its outstanding fees.</p>
          : load.state !== "done" ? <p className="mt-1.5 inline-flex items-center gap-2 text-sm text-slate-600"><Loader2 size={15} aria-hidden className="animate-spin motion-reduce:animate-none" /> Checking outstanding fees…</p>
          : !load.result.ok ? (
            <div className="mt-1.5">
              <p role="alert" className="text-sm font-medium text-red-800">{load.result.error}</p>
              <Button type="button" variant="outline" size="sm" className="mt-2.5" onClick={retry}>Try again</Button>
            </div>
          )
          : summary && summary.fees === 0 ? <p className="mt-1.5 text-sm text-slate-600">No fees have been charged to {branchName} for this billing period.</p>
          : !hasOutstanding ? (
            <div className="mt-1.5 flex items-start gap-2.5">
              <CircleCheck size={18} aria-hidden className="mt-0.5 shrink-0 text-emerald-700" />
              <div><p className="font-semibold text-emerald-900">No outstanding fees</p><p className="text-sm text-slate-600">All fees for this branch and billing period have been fully paid.</p></div>
            </div>
          ) : (
            <p className="mt-1.5 flex flex-wrap items-baseline gap-x-4 gap-y-1">
              <span className="text-xl font-semibold tabular-nums tracking-[-0.02em]">{summary!.students} {summary!.students === 1 ? "student" : "students"}</span>
              <span className="text-[0.9375rem] font-semibold tabular-nums text-slate-700">{formatMYR(summary!.outstandingSen)} outstanding</span>
            </p>
          )}
      </section>

      {hasOutstanding && (
        <div>
          <div className="flex items-end justify-between gap-3">
            <label htmlFor={`${id}-message`}>Message preview</label>
            {edited && <button type="button" onClick={() => setDraft(null)} className="inline-flex items-center gap-1 rounded-lg px-1.5 py-1 text-xs font-semibold text-primary hover:bg-primary/10 focus-visible:outline-2 focus-visible:outline-primary"><RotateCcw size={13} aria-hidden /> Reset message</button>}
          </div>
          <textarea ref={messageRef} id={`${id}-message`} value={text} onChange={(e) => { setDraft({ key: draftKey, text: e.target.value }); setCopied(""); }} rows={11} maxLength={2000} aria-describedby={`${id}-message-hint`} className="mt-1.5 text-sm leading-6" />
          <p id={`${id}-message-hint`} className="mt-1.5 flex items-start gap-1.5 text-xs text-slate-500"><Info size={13} aria-hidden className="mt-0.5 shrink-0" />A general reminder for the whole group: no student names or amounts. Edits apply to this message only.</p>
        </div>
      )}

      <div className="border-t border-border pt-5">
        <div className="flex flex-col-reverse gap-2.5 sm:flex-row sm:items-center sm:justify-end">
          <Button type="button" variant="ghost" onClick={close}>Cancel</Button>
          {hasOutstanding && <Button type="button" variant="outline" onClick={copy} disabled={!canOpen}><Copy size={16} aria-hidden /> {copied === "copied" ? "Copied" : "Copy message"}</Button>}
          {/* A link (not window.open), so popup blockers don't stop it; WhatsApp opens in a new tab or the app. */}
          {canOpen
            ? <a href={whatsappShareUrl(text)} target="_blank" rel="noopener noreferrer" className={cn(buttonVariants(), "w-full sm:w-auto")}><MessageCircle size={16} aria-hidden /> Open WhatsApp</a>
            : <Button type="button" disabled className="w-full sm:w-auto"><MessageCircle size={16} aria-hidden /> Open WhatsApp</Button>}
        </div>
        <p className="mt-3 text-xs text-slate-500 sm:text-right">You&apos;ll choose the branch group and send the message manually in WhatsApp.</p>
        {copied === "manual" && <p role="status" className="mt-1 text-xs text-slate-600 sm:text-right">The message is selected. Press Ctrl+C (⌘C on Mac) to copy it.</p>}
        {copied === "copied" && <p role="status" className="sr-only">Message copied.</p>}
      </div>
    </div>
  );
}
