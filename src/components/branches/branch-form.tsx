"use client";
import Link from "next/link";
import { ActionForm, type FormAction } from "@/components/action-form";
import { TextAreaField, TextField } from "@/components/field";
import { branchSchema } from "@/lib/validation";

export function BranchForm({ action, cancelHref, branch, submit }: { action: FormAction; cancelHref: string; branch?: { name: string; address: string }; submit: string }) {
  return (
    <ActionForm action={action} schema={branchSchema} submit={submit} footer={<Link href={cancelHref} className="px-3 text-sm font-medium text-slate-600 hover:underline">Cancel</Link>}>
      <TextField name="name" label="Branch name" defaultValue={branch?.name} required minLength={2} maxLength={120} placeholder="e.g. Shah Alam" />
      <TextAreaField name="address" label="Address" defaultValue={branch?.address} maxLength={500} hint="Optional. Where this branch trains." />
    </ActionForm>
  );
}
