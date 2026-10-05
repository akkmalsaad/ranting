"use client";
import { useState } from "react";
import { ActionForm, type FormAction } from "@/components/action-form";
import { SelectField, TextField } from "@/components/field";
import { Button } from "@/components/ui/button";
import { FormDialog, SaveWatcher, useFormDialog } from "@/components/form-dialog";
import { builtinCategories, transactionSchema, type ClubCategories } from "@/lib/finance/values";

type Branch = { id: string; name: string };
/** `categories`: the club's categories (renamed/custom); only active ones are offered. */
type FieldsProps = { requestId: string; kind: string; today: string; branches: Branch[]; branchId: string; categories?: ClubCategories };
const submitLabel = (kind: string) => (kind === "income" ? "Record payment received" : "Record expense");

/** Transaction fields; shared by the record page and the Record income/expense modal. */
function TransactionFields({ requestId, kind, today, branches, branchId, categories = builtinCategories }: FieldsProps) {
  const options = categories[kind === "expense" ? "expense" : "income"].filter((c) => !c.archived).map((c) => ({ value: c.value, label: c.label }));
  return <>
    <input type="hidden" name="request_id" value={requestId}/><input type="hidden" name="kind" value={kind}/>
    <div className="grid gap-5 sm:grid-cols-2">
      <TextField name="amount" label="Amount (MYR)" inputMode="decimal" placeholder="0.00" maxLength={12} required hint="Money actually received or paid, in ringgit."/>
      <TextField name="occurred_on" label={kind === "income" ? "Date received" : "Date paid"} type="date" defaultValue={today} min="1900-01-01" max={today} required hint="Calendar date in Asia/Kuala_Lumpur."/>
    </div>
    <TextField name="description" label="Description" maxLength={200} required hint="A brief reference for this receipt or expense. Avoid sensitive personal information."/>
    <div className="grid gap-5 sm:grid-cols-2">
      <SelectField name="category" label="Category" required options={[{value:"",label:"Choose a category"},...options]}/>
      <SelectField name="branch_id" label="Branch attribution" defaultValue={branchId} options={[{value:"",label:"Club-wide (no branch)"},...branches.map((b)=>({value:b.id,label:b.name}))]}/>
    </div>
    <p className="rounded-xl bg-slate-50 px-4 py-3 text-[0.8125rem] leading-5 text-slate-600 ring-1 ring-inset ring-border">Check these details before saving. Records are permanent in this first version; editing, voiding and refunds are not available yet.</p>
  </>;
}

/** Record transaction page (`/finances/new`). */
export function TransactionForm({ action, ...fields }: FieldsProps & { action: FormAction }) {
  return <ActionForm action={action} schema={transactionSchema} submit={submitLabel(fields.kind)}><TransactionFields {...fields}/></ActionForm>;
}

/**
 * "Record income" / "Record expense" button plus its modal (shared FormDialog, like Add student/branch).
 * Saving closes the modal; the page refreshes its totals and list and shows the record's month.
 */
export function AddTransactionDialog({ action, clubName, kind, today, branches, branchId, categories, variant, className }: { action: FormAction; clubName: string; variant?: "default" | "outline"; className?: string } & Omit<FieldsProps, "requestId">) {
  return (
    <FormDialog label={kind === "income" ? "Record income" : "Record expense"} title={kind === "income" ? "Record payment received" : "Record an expense"} description={<>{clubName} · Manual MYR records</>} trigger={variant || className ? { variant, className } : undefined}>
      <AddTransactionForm action={action} kind={kind} today={today} branches={branches} branchId={branchId} categories={categories}/>
    </FormDialog>
  );
}

function AddTransactionForm({ action, ...fields }: Omit<FieldsProps, "requestId"> & { action: FormAction }) {
  const { close } = useFormDialog();
  // One idempotency key per opening of the modal (it mounts fresh each time): retrying after an
  // error reuses it, so the record_manual_transaction RPC can't create a duplicate.
  const [requestId] = useState(newRequestId);
  return (
    <ActionForm action={action} schema={transactionSchema} submit={submitLabel(fields.kind)} footer={<Button type="button" variant="ghost" onClick={close}>Cancel</Button>}>
      <SaveWatcher/>
      <TransactionFields requestId={requestId} {...fields}/>
    </ActionForm>
  );
}

/** UUID v4; falls back to getRandomValues where randomUUID is unavailable (non-HTTPS LAN dev URLs). */
export function newRequestId() {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
