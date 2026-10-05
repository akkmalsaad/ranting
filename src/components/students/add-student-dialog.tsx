"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { Plus, X } from "lucide-react";
import { ActionForm, type FormAction } from "@/components/action-form";
import { Button } from "@/components/ui/button";
import { FormDialog, SaveWatcher, useFormDialog } from "@/components/form-dialog";
import { ChildFields, GuardianFields, MembershipFields, type StudentBranchOption } from "@/components/students/student-form";
import { childFieldName, studentBatchSchema } from "@/lib/validation";
import type { BeltLevelOption } from "@/components/students/belt-level-field";

type FormProps = { action: FormAction; clubName: string; today: string; branches: StudentBranchOption[]; initialBranchId?: string; beltLevels?: BeltLevelOption[]; settingsHref?: string };

// "3 students added." after saving siblings together; otherwise the existing "Student added.".
const studentNotice = (count: number): Record<string, string> => (count > 1 ? { notice: "created-many", count: String(count) } : { notice: "created" });

/**
 * "Add student" button plus the Add student modal (shared FormDialog/Modal).
 * One or more children can be entered before saving; each becomes its own student record,
 * sharing the guardian contact and membership details entered once below them.
 */
export function AddStudentDialog({ open, onOpenChange, hideTrigger, ...props }: FormProps & { open?: boolean; onOpenChange?: (open: boolean) => void; hideTrigger?: boolean }) {
  return (
    <FormDialog label="Add student" title="Add student" description={<>Register a student with {props.clubName}.</>} noticeParams={studentNotice} open={open} onOpenChange={onOpenChange} hideTrigger={hideTrigger}>
      <AddStudentForm {...props} />
    </FormDialog>
  );
}

function AddStudentForm({ action, today, branches, initialBranchId, beltLevels, settingsHref }: FormProps) {
  const { close } = useFormDialog();
  // Stable keys (not positions) name each child's fields, so removing a middle child never
  // shifts values between children; headings are renumbered from the current order.
  const [childKeys, setChildKeys] = useState([0]);
  const nextKey = useRef(1);
  const [focusTarget, setFocusTarget] = useState<{ key: number } | null>(null);
  const schema = useMemo(() => studentBatchSchema(childKeys.map(String)), [childKeys]);

  useEffect(() => {
    if (focusTarget) document.querySelector<HTMLInputElement>(`[name="${childFieldName(String(focusTarget.key), "full_name")}"]`)?.focus();
  }, [focusTarget]);

  function addChild() {
    const key = nextKey.current++;
    setChildKeys((keys) => [...keys, key]);
    setFocusTarget({ key });
  }

  function removeChild(key: number) {
    const index = childKeys.indexOf(key);
    setChildKeys((keys) => keys.filter((k) => k !== key));
    setFocusTarget({ key: childKeys[index - 1] ?? childKeys[0] }); // the child above
  }

  const multiple = childKeys.length > 1;
  return (
    <ActionForm action={action} schema={schema} submit="Save student" footer={<Button type="button" variant="ghost" onClick={close}>Cancel</Button>}>
      <SaveWatcher />
      <input type="hidden" name="child_keys" value={childKeys.join(",")} />
      {childKeys.map((key, index) => {
        const headingId = `add-student-child-${key}`;
        return (
          <div key={key} role="group" aria-labelledby={headingId} className="form-section grid gap-5 sm:grid-cols-2">
            <div className="flex min-w-0 items-center justify-between gap-3 sm:col-span-2">
              <h3 id={headingId} className="flex items-center gap-2.5 text-[0.9375rem] font-bold">
                {multiple && <span aria-hidden className="grid size-6 place-items-center rounded-full bg-navy text-xs font-semibold text-white tabular-nums">{index + 1}</span>}
                {multiple ? `Child ${index + 1}` : "Student"}
              </h3>
              {index > 0 && (
                <Button type="button" variant="ghost" size="sm" onClick={() => removeChild(key)} aria-label={`Remove child ${index + 1}`} className="text-red-700 hover:bg-red-50 hover:text-red-800">
                  <X size={15} aria-hidden /> Remove
                </Button>
              )}
            </div>
            <ChildFields today={today} childKey={String(key)} beltLevels={beltLevels ?? []} settingsHref={settingsHref} />
          </div>
        );
      })}
      {/* Secondary to Save: a quiet full-width row that's still easy to spot under the last child. */}
      <button type="button" onClick={addChild} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-[#c9d5da] text-sm font-semibold text-slate-600 transition-colors hover:border-primary/60 hover:bg-primary/[0.03] hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
        <Plus size={16} aria-hidden /> Add another child
      </button>
      <GuardianFields />
      <MembershipFields today={today} branches={branches} initialBranchId={initialBranchId} />
    </ActionForm>
  );
}
