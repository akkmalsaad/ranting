"use client";
import { useState } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import { ActionForm, useFormState, type FormAction } from "@/components/action-form";
import { SelectField, TextAreaField, TextField } from "@/components/field";
import { Modal } from "@/components/ui/modal";
import { buttonVariants } from "@/components/ui/button";
import { newRequestId } from "@/components/finance/transaction-form";
import { PAYMENT_METHODS, feeLinkSchema, feePaymentSchema, reasonSchema, type PaymentMethod } from "@/lib/fees/values";
import { cn } from "@/lib/utils";

const ringgit = (sen: number) => `${Math.floor(sen / 100)}.${String(sen % 100).padStart(2, "0")}`;

/**
 * Fee details panel (right-hand side from sm, bottom sheet on phones), opened from the URL
 * (?fee=…), so it survives refresh and Back. Esc and the close button return to the list view
 * (`closeHref`); the list then puts focus back on the fee's row.
 */
export function FeeModal({ closeHref, children }: { closeHref: string; children: React.ReactNode }) {
  return (
    <Modal labelledBy="fee-modal-title" dismissHref={closeHref} placement="side">
      <Link href={closeHref} scroll={false} aria-label="Close" className="absolute right-3 top-3 grid size-10 place-items-center rounded-xl text-slate-500 transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary sm:right-4 sm:top-4">
        <X size={20} aria-hidden />
      </Link>
      {children}
    </Modal>
  );
}

/**
 * Record payment: amount defaults to the balance; one Finance receipt is created with it.
 * `methods` are the club's accepted payment methods (Settings → Fees & Payments); with only one,
 * it's preselected.
 */
export function PaymentForm({ action, balanceSen, today, cancelHref, methods = PAYMENT_METHODS.map((m) => m.value) }: { action: FormAction; balanceSen: number; today: string; cancelHref: string; methods?: PaymentMethod[] }) {
  const offered = PAYMENT_METHODS.filter((m) => methods.includes(m.value));
  // One idempotency key per opening: retrying after an error reuses it (no duplicate receipt).
  const [requestId] = useState(newRequestId);
  return (
    <ActionForm action={action} schema={feePaymentSchema} submit="Record payment" footer={<Link href={cancelHref} scroll={false} className={buttonVariants({ variant: "ghost" })}>Cancel</Link>}>
      <input type="hidden" name="request_id" value={requestId} />
      <div className="grid gap-5 sm:grid-cols-2">
        <TextField name="amount" label="Payment amount (MYR)" defaultValue={ringgit(balanceSen)} inputMode="decimal" maxLength={12} required hint={`At most the balance, RM${ringgit(balanceSen)}. Partial payments are fine.`} />
        <TextField name="paid_on" label="Payment date" type="date" defaultValue={today} min="1900-01-01" max={today} required hint="The day the money was received (Malaysia time)." />
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <SelectField name="method" label="Payment method" defaultValue={offered.length === 1 ? offered[0].value : ""} options={[...(offered.length === 1 ? [] : [{ value: "", label: "Choose a method" }]), ...offered]} />
        <TextField name="reference" label="Reference (optional)" maxLength={100} placeholder="e.g. bank transfer reference" />
      </div>
      <TextAreaField name="notes" label="Notes (optional)" maxLength={500} rows={2} />
      <p className="rounded-xl bg-slate-50 px-4 py-3 text-[0.8125rem] leading-5 text-slate-600 ring-1 ring-inset ring-border">Saving also records this payment as income in Finance (on the payment date, under the fee&apos;s branch).</p>
    </ActionForm>
  );
}

export type ReceiptOption = { id: string; label: string; detail: string; availableSen: number; mismatch: boolean };

/** Link existing income: explicit choice of one receipt plus an amount within both limits. */
export function LinkReceiptForm({ action, receipts, balanceSen, cancelHref }: { action: FormAction; receipts: ReceiptOption[]; balanceSen: number; cancelHref: string }) {
  const [requestId] = useState(newRequestId);
  return (
    <ActionForm action={action} schema={feeLinkSchema} submit="Link receipt" footer={<Link href={cancelHref} scroll={false} className={buttonVariants({ variant: "ghost" })}>Cancel</Link>}>
      <input type="hidden" name="request_id" value={requestId} />
      <LinkFields receipts={receipts} balanceSen={balanceSen} />
    </ActionForm>
  );
}

function LinkFields({ receipts, balanceSen }: { receipts: ReceiptOption[]; balanceSen: number }) {
  const state = useFormState();
  const [selected, setSelected] = useState(state.values?.receipt_id ?? "");
  const receipt = receipts.find((r) => r.id === selected);
  const suggested = receipt ? Math.min(receipt.availableSen, balanceSen) : balanceSen;
  const error = state.fieldErrors?.receipt_id?.[0];
  return <>
    <fieldset>
      <legend className="text-sm font-semibold">Finance receipt</legend>
      <ul className="mt-2 max-h-72 overflow-y-auto overscroll-contain rounded-xl border border-border" aria-describedby={error ? "receipt-error" : undefined}>
        {receipts.map((r) => (
          <li key={r.id} className="border-b border-border last:border-b-0">
            <label className={cn("flex cursor-pointer items-start gap-3 px-4 py-3 font-normal transition-colors hover:bg-slate-50", selected === r.id && "bg-primary/[0.05] hover:bg-primary/[0.07]")}>
              <input type="radio" name="receipt_id" value={r.id} checked={selected === r.id} onChange={() => setSelected(r.id)} className="mt-1 size-4 shrink-0 accent-[var(--primary)]" />
              <span className="min-w-0 flex-1">
                <span className="block break-words font-semibold">{r.label}</span>
                <span className="block text-xs text-slate-500">{r.detail}</span>
                {r.mismatch && <span className="mt-1 block text-xs font-semibold text-amber-800">Different branch from this fee — both keep their own branch.</span>}
              </span>
              <span className="shrink-0 text-right text-sm tabular-nums"><span className="block font-semibold">RM{ringgit(r.availableSen)}</span><span className="block text-xs text-slate-500">available</span></span>
            </label>
          </li>
        ))}
      </ul>
      {error && <p id="receipt-error" className="mt-1.5 text-sm font-medium text-red-700">{error}</p>}
    </fieldset>
    <TextField key={selected} name="amount" label="Amount to link (MYR)" defaultValue={ringgit(suggested)} inputMode="decimal" maxLength={12} required hint={`At most the receipt's available amount and the fee balance (RM${ringgit(balanceSen)}).`} />
    <p className="text-sm text-slate-600">This links money already in Finance. No new income is recorded, and neither record&apos;s branch changes.</p>
  </>;
}

/** Void a fee / remove an allocation: a required reason and a confirming submit. */
export function ReasonForm({ action, submit, label, hint, cancelHref, danger = false }: { action: FormAction; submit: string; label: string; hint: string; cancelHref: string; danger?: boolean }) {
  return (
    <ActionForm action={action} schema={reasonSchema} submit={submit} danger={danger} footer={<Link href={cancelHref} scroll={false} className={buttonVariants({ variant: "ghost" })}>Cancel</Link>}>
      <TextAreaField name="reason" label={label} maxLength={500} rows={3} required hint={hint} />
    </ActionForm>
  );
}
