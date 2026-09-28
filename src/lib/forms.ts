import type { z } from "zod";

// Shared by Server Actions (authoritative validation) and client forms (early feedback).
export type FieldErrors = Partial<Record<string, string[]>>;
export type FormState = { error?: string; success?: string; fieldErrors?: FieldErrors; values?: Record<string, string> };

/** Plain string form values, used to refill fields after a failed submission. Passwords are never echoed back. */
export function formValues(form: FormData) {
  const values: Record<string, string> = {};
  for (const [key, value] of form) if (typeof value === "string" && !key.startsWith("$ACTION") && !/password/i.test(key)) values[key] = value;
  return values;
}

export function fieldErrors(error: z.ZodError): FieldErrors {
  const errors: FieldErrors = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    (errors[key] ??= []).push(issue.message);
  }
  return errors;
}

export type Parsed<T> = { ok: true; data: T; values: Record<string, string> } | { ok: false; state: FormState };

export function parseForm<S extends z.ZodType>(schema: S, form: FormData): Parsed<z.output<S>> {
  const values = formValues(form);
  const result = schema.safeParse(values);
  if (result.success) return { ok: true, data: result.data, values };
  return { ok: false, state: { error: "Please correct the highlighted fields.", fieldErrors: fieldErrors(result.error), values } };
}
