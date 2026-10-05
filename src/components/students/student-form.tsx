"use client";
import Link from "next/link";
import { ActionForm, type FormAction } from "@/components/action-form";
import { buttonVariants } from "@/components/ui/button";
import { SelectField, TextAreaField, TextField } from "@/components/field";
import { DateOfBirthField } from "@/components/registrations/date-of-birth-field";
import { childFieldName, studentSchema, type StaffChildField } from "@/lib/validation";
import { BeltLevelField, type BeltLevelOption } from "@/components/students/belt-level-field";
import type { Database } from "@/lib/supabase/database.types";

type Student = Pick<Database["public"]["Tables"]["students"]["Row"], "full_name" | "date_of_birth" | "gender" | "phone" | "guardian_name" | "guardian_phone" | "branch_id" | "status" | "join_date" | "notes"> & { belt_level_id?: string | null };
export type StudentBranchOption = { id: string; name: string; archived: boolean };
/** `beltLevels` (staff forms only) adds the Current belt / level selector; `settingsHref` links to Settings when none exist. */
type BeltProps = { beltLevels?: BeltLevelOption[]; settingsHref?: string };
type FieldsProps = { today: string; branches: StudentBranchOption[]; student?: Student; initialBranchId?: string } & BeltProps;

/**
 * Child-specific fields. With `childKey`, names become `child_<key>_<field>` for the multi-child forms.
 * `dateOfBirthPicker` (public registration only) swaps the native date input for the year-first
 * calendar picker; every other screen keeps the native input.
 */
export function ChildFields({ today, student, childKey, dateOfBirthPicker = false, beltLevels, settingsHref }: { today: string; student?: Student; childKey?: string; dateOfBirthPicker?: boolean } & BeltProps) {
  const nameOf = (field: StaffChildField) => (childKey === undefined ? field : childFieldName(childKey, field));
  return (
    <>
      <div className="sm:col-span-2"><TextField name={nameOf("full_name")} label="Full name" defaultValue={student?.full_name} required minLength={2} maxLength={120} autoComplete="off" /></div>
      {dateOfBirthPicker
        ? <DateOfBirthField name={nameOf("date_of_birth")} today={today} />
        : <TextField name={nameOf("date_of_birth")} label="Date of birth" type="date" defaultValue={student?.date_of_birth} max={today} min="1900-01-02" hint="Optional" />}
      <SelectField name={nameOf("gender")} label="Gender" defaultValue={student?.gender} options={[{ value: "", label: "Not specified" }, { value: "male", label: "Male" }, { value: "female", label: "Female" }]} />
      <TextField name={nameOf("phone")} label="Phone" type="tel" defaultValue={student?.phone} maxLength={20} autoComplete="off" hint="Optional, e.g. 012-345 6789" />
      {beltLevels && <BeltLevelField name={nameOf("belt_level_id")} levels={beltLevels} defaultValue={student?.belt_level_id} settingsHref={settingsHref} />}
    </>
  );
}

/** Guardian contact: plain text on each student record, never used for access. */
export function GuardianFields({ student }: { student?: Student }) {
  return (
    <fieldset className="form-section grid gap-5 sm:grid-cols-2">
      <legend className="form-legend">Guardian contact</legend>
      <TextField name="guardian_name" label="Guardian name" defaultValue={student?.guardian_name} maxLength={120} autoComplete="off" hint="Optional. For contact only." />
      <TextField name="guardian_phone" label="Guardian phone" type="tel" defaultValue={student?.guardian_phone} maxLength={20} autoComplete="off" hint="Optional" />
    </fieldset>
  );
}

export function MembershipFields({ today, branches, student, initialBranchId }: FieldsProps) {
  const branchOptions = [{ value: "", label: "No branch" }, ...branches.map((b) => ({ value: b.id, label: b.archived ? `${b.name} (archived)` : b.name }))];
  return (
    <fieldset className="form-section grid gap-5 sm:grid-cols-2">
      <legend className="form-legend">Membership</legend>
      <SelectField name="branch_id" label="Branch" defaultValue={student?.branch_id ?? initialBranchId} options={branchOptions} />
      <SelectField name="status" label="Status" defaultValue={student?.status ?? "active"} options={[{ value: "active", label: "Active" }, { value: "inactive", label: "Inactive" }]} required />
      <TextField name="join_date" label="Join date" type="date" defaultValue={student?.join_date ?? today} required min="1900-01-02" />
      <div className="sm:col-span-2"><TextAreaField name="notes" label="Notes" defaultValue={student?.notes} maxLength={2000} hint="Optional. Avoid sensitive medical details unless needed." /></div>
    </fieldset>
  );
}

/** All student fields, grouped as Student / Guardian contact / Membership (Add and Edit student pages). */
export function StudentFields(props: FieldsProps) {
  return (
    <>
      <fieldset className="form-section grid gap-5 sm:grid-cols-2">
        <legend className="form-legend">Student</legend>
        <ChildFields today={props.today} student={props.student} beltLevels={props.beltLevels} settingsHref={props.settingsHref} />
      </fieldset>
      <GuardianFields student={props.student} />
      <MembershipFields {...props} />
    </>
  );
}

/** Full-page student form (Add student page and Edit student). */
export function StudentForm({ action, cancelHref, submit, ...fields }: FieldsProps & { action: FormAction; cancelHref: string; submit: string }) {
  return (
    <ActionForm action={action} schema={studentSchema} submit={submit} footer={<Link href={cancelHref} className={buttonVariants({ variant: "ghost" })}>Cancel</Link>}>
      <StudentFields {...fields} />
    </ActionForm>
  );
}
