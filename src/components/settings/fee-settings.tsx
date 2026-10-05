"use client";
import { useMemo } from "react";
import { ActionForm } from "@/components/action-form";
import { TextField } from "@/components/field";
import { Button } from "@/components/ui/button";
import { FormDialog, SaveWatcher, useFormDialog } from "@/components/form-dialog";
import { PAYMENT_METHODS, type PaymentMethod } from "@/lib/fees/values";
import { feeDefaultsSchema } from "@/lib/settings-values";
import { saveFeeDefaults, savePaymentMethods } from "@/app/clubs/[clubId]/settings/preference-actions";

const ringgit = (sen: number) => `${Math.floor(sen / 100)}.${String(sen % 100).padStart(2, "0")}`;
const notice = (code: string) => () => ({ notice: code });

/** Edit dialog for the monthly fee defaults (they only prefill Generate monthly fees). */
export function FeeDefaultsDialog({ clubId, amountSen, dueDay }: { clubId: string; amountSen: number | null; dueDay: number | null }) {
  return (
    <FormDialog label="Edit" title="Monthly fee defaults" description="Used to prefill Generate monthly fees. You can still change them each time, and existing fees are never changed." noticeParams={notice("fees-saved")} modalClassName="sm:max-w-lg" trigger={{ icon: "none", variant: "outline", size: "sm", ariaLabel: "Edit monthly fee defaults" }}>
      <FeeDefaultsForm clubId={clubId} amountSen={amountSen} dueDay={dueDay} />
    </FormDialog>
  );
}

function FeeDefaultsForm({ clubId, amountSen, dueDay }: { clubId: string; amountSen: number | null; dueDay: number | null }) {
  const { close } = useFormDialog();
  const action = useMemo(() => saveFeeDefaults.bind(null, clubId), [clubId]);
  return (
    <ActionForm action={action} schema={feeDefaultsSchema} submit="Save changes" footer={<Button type="button" variant="ghost" onClick={close}>Cancel</Button>}>
      <SaveWatcher />
      <div className="grid gap-5 sm:grid-cols-2">
        <TextField name="amount" label="Default monthly fee (MYR)" defaultValue={amountSen ? ringgit(amountSen) : ""} inputMode="decimal" placeholder="0.00" maxLength={12} hint="Leave blank for no default." />
        <TextField name="due_day" label="Payment due day" defaultValue={dueDay ? String(dueDay) : ""} inputMode="numeric" placeholder="e.g. 7" maxLength={2} hint="Day of the month, 1–31. Short months use their last day." />
      </div>
    </ActionForm>
  );
}

/** Edit dialog for the payment methods offered in Record payment (at least one). */
export function PaymentMethodsDialog({ clubId, methods }: { clubId: string; methods: PaymentMethod[] }) {
  return (
    <FormDialog label="Edit" title="Payment methods" description="Choose the methods offered when you record a payment. Past payments keep the method they were recorded with." noticeParams={notice("methods-saved")} modalClassName="sm:max-w-lg" trigger={{ icon: "none", variant: "outline", size: "sm", ariaLabel: "Edit payment methods" }}>
      <PaymentMethodsForm clubId={clubId} methods={methods} />
    </FormDialog>
  );
}

function PaymentMethodsForm({ clubId, methods }: { clubId: string; methods: PaymentMethod[] }) {
  const { close } = useFormDialog();
  const action = useMemo(() => savePaymentMethods.bind(null, clubId), [clubId]);
  return (
    <ActionForm action={action} submit="Save changes" footer={<Button type="button" variant="ghost" onClick={close}>Cancel</Button>}>
      <SaveWatcher />
      <fieldset>
        <legend className="sr-only">Accepted payment methods</legend>
        <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border">
          {PAYMENT_METHODS.map((m) => (
            <li key={m.value}>
              <label className="flex cursor-pointer items-center gap-3 px-4 py-3.5 font-medium transition-colors hover:bg-slate-50">
                <input type="checkbox" name={`method_${m.value}`} defaultChecked={methods.includes(m.value)} className="size-4 shrink-0" />
                {m.label}
              </label>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-slate-500">Keep at least one method. This is a list only; no payment provider is connected.</p>
      </fieldset>
    </ActionForm>
  );
}
