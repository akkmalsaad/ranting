"use client";
import { createContext, useActionState, useContext } from "react";
import type { z } from "zod";
import { Button } from "@/components/ui/button";
import { formValues, parseForm, type FormState } from "@/lib/forms";

export type { FormState };
export type FormAction = (state: FormState, data: FormData) => Promise<FormState>;

const FormStateContext = createContext<FormState>({});
export const useFormState = () => useContext(FormStateContext);

/**
 * Server Action form with pending, error and success states. When `schema` is given,
 * the same schema the server uses runs first in the browser; the server still validates.
 */
export function ActionForm({ action, children, submit = "Save changes", danger = false, schema, footer }: { action: FormAction; children?: React.ReactNode; submit?: string; danger?: boolean; schema?: z.ZodType; footer?: React.ReactNode }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(async (previous, data) => {
    if (schema) {
      const parsed = parseForm(schema, data);
      if (!parsed.ok) return parsed.state;
    }
    const next = await action(previous, data);
    return next.error && !next.values ? { ...next, values: formValues(data) } : next;
  }, {});
  return (
    <FormStateContext value={state}>
      <form action={formAction} className="space-y-5">
        <fieldset disabled={pending} className="space-y-5">{children}</fieldset>
        {state.error && <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-800">{state.error}</p>}
        {state.success && <p role="status" className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-900">{state.success}</p>}
        <div className="flex flex-wrap items-center gap-3">
          <Button variant={danger ? "destructive" : "default"} disabled={pending} type="submit">{pending ? "Saving…" : submit}</Button>
          {footer}
        </div>
      </form>
    </FormStateContext>
  );
}
