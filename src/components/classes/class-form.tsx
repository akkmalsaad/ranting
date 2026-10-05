"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { Check } from "lucide-react";
import Link from "next/link";
import { ActionForm, useFormState, type FormAction } from "@/components/action-form";
import { SelectField, TextAreaField, TextField } from "@/components/field";
import { Button, buttonVariants } from "@/components/ui/button";
import { FormDialog, SaveWatcher, useFormDialog } from "@/components/form-dialog";
import { CLASS_WEEKDAYS, MAX_SERIES_DAYS, classCreateSchema, classSessionSchema, isoWeekday, weeklyDates } from "@/lib/validation";
import type { ClassBranch, ClassSession } from "@/lib/classes-shared";
import { createClass, updateClass } from "@/app/clubs/[clubId]/classes/actions";

const Legend = ({ children }: { children: React.ReactNode }) => <legend className="form-legend">{children}</legend>;

/**
 * Class fields shared by Add class and Edit class. Branch lists current branches only; when
 * editing a class whose branch has since been archived, that branch stays selectable so the
 * class can be saved without moving it (new or moved classes can't use an archived branch).
 * `current_branch` is the page's branch filter, so the page can switch to the saved class's branch.
 * `repeatable` (Add class only) adds the weekly repeat options.
 */
function ClassFields({ session, branches, initialBranchId, initialDate, currentBranch, extraBranch, repeatable = false }: { session?: ClassSession; branches: ClassBranch[]; initialBranchId: string; initialDate: string; currentBranch: string; extraBranch?: ClassBranch; repeatable?: boolean }) {
  const state = useFormState();
  const [weekly, setWeekly] = useState(state.values?.repeat === "weekly");
  const options = [
    { value: "", label: "Choose a branch" },
    ...branches.map((b) => ({ value: b.id, label: b.name })),
    ...(extraBranch ? [{ value: extraBranch.id, label: `${extraBranch.name} (archived)` }] : []),
  ];
  return (
    <>
      <input type="hidden" name="current_branch" value={currentBranch} />
      <fieldset className="form-section grid gap-5 sm:grid-cols-2">
        <Legend>Class</Legend>
        <div className="sm:col-span-2"><TextField name="name" label="Class name" defaultValue={session?.name} required minLength={2} maxLength={120} autoComplete="off" placeholder="e.g. Kids Beginners" /></div>
        <div className="sm:col-span-2"><SelectField name="branch_id" label="Branch" defaultValue={session?.branch_id ?? initialBranchId} options={options} required /></div>
      </fieldset>
      <fieldset className="form-section grid gap-5 sm:grid-cols-3">
        <Legend>Date and time</Legend>
        <TextField name="session_date" label={weekly ? "Starts on" : "Date"} type="date" defaultValue={session?.session_date ?? initialDate} min="1900-01-02" max="2199-12-31" required />
        <TextField name="start_time" label="Start time" type="time" defaultValue={session?.start_time.slice(0, 5)} required />
        <TextField name="end_time" label="End time" type="time" defaultValue={session?.end_time.slice(0, 5)} required />
        <p className="-mt-2 text-xs text-slate-500 sm:col-span-3">Malaysia time (Asia/Kuala_Lumpur). The end time must be after the start time.</p>
        {repeatable && <RepeatFields weekly={weekly} onWeeklyChange={setWeekly} initialDate={initialDate} />}
      </fieldset>
      <fieldset className="form-section grid gap-5">
        <Legend>Details</Legend>
        <TextField name="instructor_name" label="Instructor" defaultValue={session?.instructor_name} minLength={2} maxLength={120} autoComplete="off" hint="Optional. The instructor's name for this class." />
        <TextAreaField name="notes" label="Notes" defaultValue={session?.notes} maxLength={2000} hint="Optional. Avoid sensitive personal information." />
      </fieldset>
    </>
  );
}

/**
 * Number of classes a weekly series would create; null until the dates and days are complete,
 * -1 when the range is longer than allowed.
 */
function weeklyCount(start: string, until: string, days: number[]) {
  const date = /^\d{4}-\d{2}-\d{2}$/;
  if (!date.test(start) || !date.test(until) || until <= start || !days.length) return null;
  if ((Date.parse(`${until}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86_400_000 > MAX_SERIES_DAYS) return -1;
  return weeklyDates(start, until, days).length;
}

/**
 * Add class repeat options: "Does not repeat" or "Weekly" on chosen days until a last date
 * (up to one year). Shows how many classes will be created; the server re-validates and creates
 * every session in one transaction.
 */
function RepeatFields({ weekly, onWeeklyChange, initialDate }: { weekly: boolean; onWeeklyChange: (weekly: boolean) => void; initialDate: string }) {
  const state = useFormState();
  const values = state.values;
  const checked = (day: number) => (values ? values[`weekday_${day}`] === "on" : day === isoWeekday(initialDate));
  const [count, setCount] = useState(() => weeklyCount(values?.session_date ?? initialDate, values?.repeat_until ?? "", CLASS_WEEKDAYS.filter((d) => checked(d.value)).map((d) => d.value)));
  const dayError = state.fieldErrors?.weekdays?.[0];
  const root = useRef<HTMLDivElement>(null);

  // Preview from the form's current values; the start date lives outside this block, so listen on the form.
  useEffect(() => {
    const form = root.current?.closest("form");
    if (!weekly || !form) return;
    const update = () => {
      const data = new FormData(form);
      setCount(weeklyCount(String(data.get("session_date") ?? ""), String(data.get("repeat_until") ?? ""), CLASS_WEEKDAYS.filter((d) => data.get(`weekday_${d.value}`)).map((d) => d.value)));
    };
    form.addEventListener("input", update);
    form.addEventListener("change", update);
    return () => {
      form.removeEventListener("input", update);
      form.removeEventListener("change", update);
    };
  }, [weekly]);

  return (
    <div ref={root} className="grid gap-5 sm:col-span-3">
      <SelectField name="repeat" label="Repeat" defaultValue={weekly ? "weekly" : "none"} options={[{ value: "none", label: "Does not repeat" }, { value: "weekly", label: "Weekly" }]} onChange={(e) => onWeeklyChange(e.target.value === "weekly")} />
      {weekly && (
        <>
          <fieldset aria-describedby={dayError ? "repeat-days-error" : undefined}>
            <legend className="text-sm font-semibold">Repeat on</legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {CLASS_WEEKDAYS.map((d) => (
                <label key={d.value} className="cursor-pointer font-semibold">
                  <input type="checkbox" name={`weekday_${d.value}`} defaultChecked={checked(d.value)} aria-label={d.long} className="peer sr-only" />
                  <span aria-hidden className="inline-flex h-10 min-w-14 items-center justify-center gap-1 rounded-xl border border-border bg-white px-3 text-sm transition-colors hover:border-primary/50 peer-checked:border-navy peer-checked:bg-navy peer-checked:text-white peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-primary [&>svg]:hidden peer-checked:[&>svg]:block">
                    <Check size={14} />{d.short}
                  </span>
                </label>
              ))}
            </div>
            {dayError && <p id="repeat-days-error" className="mt-1.5 text-sm font-medium text-red-700">{dayError}</p>}
          </fieldset>
          <TextField name="repeat_until" label="Repeat until" type="date" min={initialDate} required hint={`The date of the last class. Up to one year (${MAX_SERIES_DAYS} days) after the start date.`} />
          <p role="status" className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-700 ring-1 ring-inset ring-border">
            {count === null ? "Choose the days and a last date to see how many classes will be scheduled." : count === -1 ? "A weekly class can repeat for up to one year." : count === 0 ? "None of the chosen days fall between these dates." : `${count} ${count === 1 ? "class" : "classes"} will be scheduled. Each one can be edited or cancelled on its own later.`}
          </p>
        </>
      )}
    </div>
  );
}

/** "Add class" button plus the Add class modal (same FormDialog/Modal as Add student and Add branch). */
export function AddClassDialog({ clubId, branches, initialBranchId, initialDate, currentBranch }: { clubId: string; branches: ClassBranch[]; initialBranchId: string; initialDate: string; currentBranch: string }) {
  return (
    <FormDialog label="Add class" title="Add class" description="Schedule a one-off class or a weekly class.">
      {branches.length === 0 ? <NoBranches clubId={clubId} /> : <AddClassForm clubId={clubId} branches={branches} initialBranchId={initialBranchId} initialDate={initialDate} currentBranch={currentBranch} />}
    </FormDialog>
  );
}

function NoBranches({ clubId }: { clubId: string }) {
  const { close } = useFormDialog();
  return (
    <div className="space-y-5">
      <p className="rounded-xl border border-amber-200/80 bg-amber-50 px-4 py-3 text-sm text-amber-900">Classes belong to a branch. Add a branch first, then schedule its classes.</p>
      <div className="flex flex-col-reverse gap-2.5 sm:flex-row sm:justify-end">
        <Button type="button" variant="ghost" onClick={close}>Cancel</Button>
        <Link href={`/clubs/${clubId}/branches`} className={buttonVariants()}>Go to Branches</Link>
      </div>
    </div>
  );
}

function AddClassForm({ clubId, ...fields }: { clubId: string; branches: ClassBranch[]; initialBranchId: string; initialDate: string; currentBranch: string }) {
  const { close } = useFormDialog();
  const action: FormAction = useMemo(() => createClass.bind(null, clubId), [clubId]);
  return (
    <ActionForm action={action} schema={classCreateSchema} submit="Add class" footer={<Button type="button" variant="ghost" onClick={close}>Cancel</Button>}>
      <SaveWatcher />
      <ClassFields {...fields} repeatable />
    </ActionForm>
  );
}

const updatedNotice = (): Record<string, string> => ({ notice: "updated" });

/** Edit class modal (controlled: opened from the table or the details modal), prefilled with the class. */
export function EditClassDialog({ clubId, session, branches, allBranches, currentBranch, onClose }: { clubId: string; session: ClassSession; branches: ClassBranch[]; allBranches: ClassBranch[]; currentBranch: string; onClose: () => void }) {
  const onOpenChange = (open: boolean) => { if (!open) onClose(); };
  const own = allBranches.find((b) => b.id === session.branch_id);
  return (
    <FormDialog label="Edit" title="Edit class" description={<>Update {session.name}.</>} noticeParams={updatedNotice} open onOpenChange={onOpenChange} hideTrigger>
      <EditClassForm clubId={clubId} session={session} branches={branches} extraBranch={own?.archived_at ? own : undefined} currentBranch={currentBranch} />
    </FormDialog>
  );
}

function EditClassForm({ clubId, session, ...fields }: { clubId: string; session: ClassSession; branches: ClassBranch[]; extraBranch?: ClassBranch; currentBranch: string }) {
  const { close } = useFormDialog();
  const action: FormAction = useMemo(() => updateClass.bind(null, clubId, session.id), [clubId, session.id]);
  return (
    <ActionForm action={action} schema={classSessionSchema} submit="Save changes" footer={<Button type="button" variant="ghost" onClick={close}>Cancel</Button>}>
      <SaveWatcher />
      <ClassFields session={session} initialBranchId={session.branch_id} initialDate={session.session_date} {...fields} />
    </ActionForm>
  );
}
