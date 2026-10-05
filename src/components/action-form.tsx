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
export function ActionForm({ action, children, submit = "Save changes", danger = false, schema, footer, layout = "default" }: {
  action: FormAction;
  children?: React.ReactNode;
  submit?: string;
  danger?: boolean;
  schema?: z.ZodType;
  footer?: React.ReactNode;
  /** "dialog" (inside `FormDialog scrollBody`): the fields scroll; messages and actions stay pinned in a footer bar. */
  layout?: "default" | "dialog";
}) {
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

  const fields = <fieldset disabled={pending} className="space-y-5">{children}</fieldset>;
  const messages = <>
    {state.error && <p role="alert" className="rounded-xl border border-red-200/70 bg-red-50 px-4 py-3 text-sm text-red-800">{state.error}</p>}
    {state.success && <p role="status" className="rounded-xl border border-emerald-200/70 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">{state.success}</p>}
  </>;
  const submitButton = <Button variant={danger ? "destructive" : "default"} disabled={pending} type="submit">{pending ? "Saving…" : submit}</Button>;

  if (layout === "dialog") {
    return (
      <FormStateContext value={state}>
        <form action={formAction} onSubmit={validate} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-6 sm:px-8">{fields}</div>
          {/* Pinned footer: the form-level message (so it's seen without scrolling) and the actions. */}
          <div className="shrink-0 space-y-3 border-t border-border bg-slate-50/80 px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-8">
            {messages}
            <div className="flex flex-col-reverse gap-2.5 sm:flex-row sm:items-center sm:justify-end">
              {footer}
              {submitButton}
            </div>
          </div>
        </form>
      </FormStateContext>
    );
  }

  return (
    <FormStateContext value={state}>
      <form action={formAction} onSubmit={validate} className="space-y-5">
        {fields}
        {messages}
        {/* With a secondary action (Cancel) the pair sits right-aligned, primary last; a lone
            submit (e.g. Archive) stays with its section's text on the left. */}
        <div className={footer ? "flex flex-col-reverse gap-2.5 pt-1 sm:flex-row sm:items-center sm:justify-end" : "flex flex-wrap items-center gap-3"}>
          {footer}
          {submitButton}
        </div>
      </form>
    </FormStateContext>
  );
}
