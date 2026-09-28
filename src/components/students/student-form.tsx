"use client";
import Link from "next/link";
import { ActionForm, type FormAction } from "@/components/action-form";
import { SelectField, TextAreaField, TextField } from "@/components/field";
import { studentSchema } from "@/lib/validation";
import type { Database } from "@/lib/supabase/database.types";

type Student = Pick<Database["public"]["Tables"]["students"]["Row"], "full_name" | "date_of_birth" | "gender" | "phone" | "guardian_name" | "guardian_phone" | "branch_id" | "status" | "join_date" | "notes">;

export function StudentForm({ action, cancelHref, submit, today, branches, student }: { action: FormAction; cancelHref: string; submit: string; today: string; branches: { id: string; name: string; archived: boolean }[]; student?: Student }) {
  const branchOptions = [{ value: "", label: "No branch" }, ...branches.map((b) => ({ value: b.id, label: b.archived ? `${b.name} (archived)` : b.name }))];
  return (
    <ActionForm action={action} schema={studentSchema} submit={submit} footer={<Link href={cancelHref} className="px-3 text-sm font-medium text-slate-600 hover:underline">Cancel</Link>}>
      <fieldset className="grid gap-5 sm:grid-cols-2">
        <legend className="mb-4 text-base font-bold">Student</legend>
        <div className="sm:col-span-2"><TextField name="full_name" label="Full name" defaultValue={student?.full_name} required minLength={2} maxLength={120} autoComplete="off" /></div>
        <TextField name="date_of_birth" label="Date of birth" type="date" defaultValue={student?.date_of_birth} max={today} min="1900-01-02" hint="Optional" />
        <SelectField name="gender" label="Gender" defaultValue={student?.gender} options={[{ value: "", label: "Not specified" }, { value: "male", label: "Male" }, { value: "female", label: "Female" }]} />
        <TextField name="phone" label="Phone" type="tel" defaultValue={student?.phone} maxLength={20} autoComplete="off" hint="Optional, e.g. 012-345 6789" />
      </fieldset>
      <fieldset className="grid gap-5 sm:grid-cols-2">
        <legend className="mb-4 text-base font-bold">Guardian contact</legend>
        <TextField name="guardian_name" label="Guardian name" defaultValue={student?.guardian_name} maxLength={120} autoComplete="off" hint="Optional. For contact only." />
        <TextField name="guardian_phone" label="Guardian phone" type="tel" defaultValue={student?.guardian_phone} maxLength={20} autoComplete="off" hint="Optional" />
      </fieldset>
      <fieldset className="grid gap-5 sm:grid-cols-2">
        <legend className="mb-4 text-base font-bold">Membership</legend>
        <SelectField name="branch_id" label="Branch" defaultValue={student?.branch_id} options={branchOptions} />
        <SelectField name="status" label="Status" defaultValue={student?.status ?? "active"} options={[{ value: "active", label: "Active" }, { value: "inactive", label: "Inactive" }]} required />
        <TextField name="join_date" label="Join date" type="date" defaultValue={student?.join_date ?? today} required min="1900-01-02" />
        <div className="sm:col-span-2"><TextAreaField name="notes" label="Notes" defaultValue={student?.notes} maxLength={2000} hint="Optional. Avoid sensitive medical details unless needed." /></div>
      </fieldset>
    </ActionForm>
  );
}
