"use client";
import { createContext, useActionState, useContext, useState } from "react";
import type { z } from "zod";
import { Button } from "@/components/ui/button";
import { parseForm, type FormState } from "@/lib/forms";

export type { FormState };
export type FormAction = (state: FormState, data: FormData) => Promise<FormState>;

const FormStateContext = createContext<FormState>({});
export const useFormState = () => useContext(FormStateContext);

/**
 * Server Action form with pending, error and success states.
 *
 * `action` is handed to useActionState unwrapped so the server-rendered form posts to the Server
 * Action even before hydration (progressive enhancement). Inputs are uncontrolled, so autofilled
 * and pasted values are submitted from the DOM. When `schema` is given, it runs in onSubmit against
 * the form's actual FormData and only cancels submission when invalid; the server always re-validates.
 */
export function ActionForm({ action, children, submit = "Save changes", danger = false, schema, footer }: { action: FormAction; children?: React.ReactNode; submit?: string; danger?: boolean; schema?: z.ZodType; footer?: React.ReactNode }) {
  const [serverState, formAction, pending] = useActionState<FormState, FormData>(action, {});
  const [clientState, setClientState] = useState<FormState | null>(null);
  const state = clientState ?? serverState;

  function validate(event: React.FormEvent<HTMLFormElement>) {
    if (!schema) return;
    const parsed = parseForm(schema, new FormData(event.currentTarget));
    if (parsed.ok) return setClientState(null);
    event.preventDefault();
    setClientState(parsed.state);
  }

  return (
    <FormStateContext value={state}>
      <form action={formAction} onSubmit={validate} className="space-y-5">
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
