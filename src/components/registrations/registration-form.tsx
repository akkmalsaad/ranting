"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { MapPin, Plus } from "lucide-react";
import { ActionForm, type FormAction } from "@/components/action-form";
import { TextAreaField, TextField } from "@/components/field";
import { Button } from "@/components/ui/button";
import { ChildFields } from "@/components/students/student-form";
import { MAX_REGISTRATION_CHILDREN, childFieldName, publicRegistrationBatchSchema } from "@/lib/validation";
import { cn } from "@/lib/utils";

/**
 * Parent registration form: guardian details once, then one or more children using the same
 * student fields as Add student. Every child is registered for the link's branch.
 */
export function RegistrationForm({ action, today, branchName }: { action: FormAction; today: string; branchName: string }) {
  // Stable keys (not positions) name each child's fields, so removing a child never moves values
  // or errors to another child; headings are renumbered from the current order.
  const [childKeys, setChildKeys] = useState([0]);
  const nextKey = useRef(1);
  const sectionsRef = useRef<HTMLDivElement>(null);
  const [focusTarget, setFocusTarget] = useState<{ key: number } | null>(null);
  const schema = useMemo(() => publicRegistrationBatchSchema(childKeys.map(String)), [childKeys]);

  useEffect(() => {
    if (focusTarget) sectionsRef.current?.querySelector<HTMLInputElement>(`[name="${childFieldName(String(focusTarget.key), "full_name")}"]`)?.focus();
  }, [focusTarget]);

  function addChild() {
    if (childKeys.length >= MAX_REGISTRATION_CHILDREN) return;
    const key = nextKey.current++;
    setChildKeys((keys) => [...keys, key]);
    setFocusTarget({ key });
  }

  function removeChild(key: number) {
    const index = childKeys.indexOf(key);
    setChildKeys((keys) => keys.filter((k) => k !== key));
    setFocusTarget({ key: childKeys[index - 1] ?? childKeys[0] });
  }

  const count = childKeys.length;
  return (
    <ActionForm action={action} schema={schema} submit={count > 1 ? `Submit registration for ${count} children` : "Submit registration"}>
      <fieldset className="grid gap-5 sm:grid-cols-2">
        <legend className="mb-4 text-base font-bold">Parent / guardian</legend>
        <TextField name="guardian_name" label="Parent / guardian name" required minLength={2} maxLength={120} autoComplete="name" />
        <TextField name="guardian_phone" label="Parent / guardian phone" type="tel" required maxLength={20} autoComplete="tel" hint="The club will use this to contact you, e.g. 012-345 6789" />
        <div className="sm:col-span-2"><TextAreaField name="notes" label="Anything the club should know?" maxLength={2000} hint="Optional. Applies to all children below. Avoid sensitive medical details unless needed." /></div>
      </fieldset>

      <input type="hidden" name="child_keys" value={childKeys.join(",")} />
      <p className="flex items-center gap-2 rounded-xl bg-primary/5 px-4 py-3 text-sm text-slate-700">
        <MapPin size={16} aria-hidden className="shrink-0 text-primary" />
        <span>{count > 1 ? "All children" : "Your child"} will be registered for <span className="font-semibold text-foreground">{branchName}</span>.</span>
      </p>

      <div ref={sectionsRef} className="space-y-6">
        {childKeys.map((key, index) => {
          const headingId = `registration-child-${key}`;
          return (
            <div key={key} role="group" aria-labelledby={headingId} className={cn("grid gap-5 sm:grid-cols-2", index > 0 && "border-t border-border pt-6")}>
              <div className="flex min-w-0 items-center justify-between gap-3 sm:col-span-2">
                <h3 id={headingId} className="text-base font-bold">Child {index + 1}</h3>
                {index > 0 && (
                  <button type="button" onClick={() => removeChild(key)} aria-label={`Remove child ${index + 1}`} className="shrink-0 rounded-lg px-2 py-1 text-sm font-semibold text-red-700 hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
                    Remove child
                  </button>
                )}
              </div>
              <ChildFields today={today} childKey={String(key)} dateOfBirthPicker />
            </div>
          );
        })}
      </div>
      {count < MAX_REGISTRATION_CHILDREN
        ? <Button type="button" variant="outline" onClick={addChild} className="h-10 min-h-0 px-4 py-0"><Plus size={16} aria-hidden /> Add another child</Button>
        : <p className="text-sm text-slate-600">You can register up to {MAX_REGISTRATION_CHILDREN} children at once. Submit this form, then use the link again for more.</p>}

      {/* Honeypot: hidden from people and assistive tech; bots that fill it are ignored. */}
      <div aria-hidden="true" className="hidden">
        <label>Website<input name="website" type="text" tabIndex={-1} autoComplete="off" /></label>
      </div>
    </ActionForm>
  );
}
