"use client";
import { useId } from "react";
import { Input } from "@/components/ui/input";
import { useFormState } from "@/components/action-form";

type Common = { name: string; label: string; hint?: string; defaultValue?: string | null };

/** Label, hint and error wiring shared by every field; refills the value after a failed submission. */
function useField({ name, defaultValue }: Common) {
  const id = useId();
  const state = useFormState();
  const error = state.fieldErrors?.[name]?.[0];
  const value = state.values?.[name] ?? defaultValue ?? "";
  return { id, error, value, describedBy: [error && `${id}-error`, `${id}-hint`].filter(Boolean).join(" ") };
}

function Frame({ id, label, hint, error, children }: { id: string; label: string; hint?: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={id}>{label}</label>
      <div className="mt-2">{children}</div>
      {hint && <p id={`${id}-hint`} className="mt-1.5 text-xs text-slate-500">{hint}</p>}
      {error && <p id={`${id}-error`} className="mt-1.5 text-sm font-medium text-red-700">{error}</p>}
    </div>
  );
}

export function TextField({ name, label, hint, defaultValue, ...props }: Common & Omit<React.ComponentProps<"input">, "name" | "defaultValue">) {
  const f = useField({ name, label, defaultValue });
  return <Frame id={f.id} label={label} hint={hint} error={f.error}><Input key={f.value} id={f.id} name={name} defaultValue={f.value} aria-invalid={!!f.error} aria-describedby={f.describedBy} {...props} /></Frame>;
}

export function TextAreaField({ name, label, hint, defaultValue, ...props }: Common & Omit<React.ComponentProps<"textarea">, "name" | "defaultValue">) {
  const f = useField({ name, label, defaultValue });
  return <Frame id={f.id} label={label} hint={hint} error={f.error}><textarea key={f.value} id={f.id} name={name} defaultValue={f.value} rows={4} aria-invalid={!!f.error} aria-describedby={f.describedBy} {...props} /></Frame>;
}

export function SelectField({ name, label, hint, defaultValue, options, ...props }: Common & { options: { value: string; label: string }[] } & Omit<React.ComponentProps<"select">, "name" | "defaultValue">) {
  const f = useField({ name, label, defaultValue });
  return <Frame id={f.id} label={label} hint={hint} error={f.error}><select key={f.value} id={f.id} name={name} defaultValue={f.value} aria-invalid={!!f.error} aria-describedby={f.describedBy} {...props}>{options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select></Frame>;
}
