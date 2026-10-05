"use client";
import { createContext, useContext, useMemo } from "react";
import { ActionForm } from "@/components/action-form";
import { Button } from "@/components/ui/button";
import { FormDialog, SaveWatcher, useFormDialog } from "@/components/form-dialog";
import { StudentFields, type StudentBranchOption } from "@/components/students/student-form";
import { editStudent } from "@/app/clubs/[clubId]/students/actions";
import { studentSchema } from "@/lib/validation";
import type { BeltLevelOption } from "@/components/students/belt-level-field";
import type { Database } from "@/lib/supabase/database.types";

export type EditableStudent = Pick<Database["public"]["Tables"]["students"]["Row"], "id" | "full_name" | "date_of_birth" | "gender" | "phone" | "guardian_name" | "guardian_phone" | "branch_id" | "status" | "join_date" | "notes" | "belt_level_id">;
type Branch = { id: string; name: string; archived_at: string | null };
type EditContextValue = { clubId: string; today: string; branches: Branch[]; beltLevels?: BeltLevelOption[] };

const EditContext = createContext<EditContextValue | null>(null);

/** Supplies the club, Malaysia "today" and branch list once for every Edit button below it. */
export function StudentEditProvider({ clubId, today, branches, beltLevels = [], children }: EditContextValue & { children: React.ReactNode }) {
  const value = useMemo(() => ({ clubId, today, branches, beltLevels }), [clubId, today, branches, beltLevels]);
  return <EditContext value={value}>{children}</EditContext>;
}

/**
 * "Edit" button plus the Edit Student modal: the same FormDialog, fields and validation as
 * Add student, prefilled with this student's record. Saving updates the existing record.
 */
export function EditStudentDialog({ student }: { student: EditableStudent }) {
  const context = useContext(EditContext);
  if (!context) throw new Error("EditStudentDialog must be rendered inside StudentEditProvider.");
  // Current branches, plus the student's own branch if it has since been archived (as on the Edit page).
  const branches: StudentBranchOption[] = context.branches
    .filter((b) => !b.archived_at || b.id === student.branch_id)
    .map((b) => ({ id: b.id, name: b.name, archived: !!b.archived_at }));
  return (
    <FormDialog
      label="Edit"
      title="Edit student"
      description={<>Update {student.full_name}&apos;s details.</>}
      noticeParams={updatedNotice}
      trigger={{ icon: "pencil", variant: "outline", size: "sm", ariaLabel: `Edit ${student.full_name}` }}
    >
      <EditStudentForm clubId={context.clubId} today={context.today} branches={branches} beltLevels={context.beltLevels ?? []} student={student} />
    </FormDialog>
  );
}

const updatedNotice = (): Record<string, string> => ({ notice: "updated" });

function EditStudentForm({ clubId, today, branches, beltLevels, student }: { clubId: string; today: string; branches: StudentBranchOption[]; beltLevels: BeltLevelOption[]; student: EditableStudent }) {
  const { close } = useFormDialog();
  const action = useMemo(() => editStudent.bind(null, clubId, student.id), [clubId, student.id]);
  return (
    <ActionForm action={action} schema={studentSchema} submit="Save changes" footer={<Button type="button" variant="ghost" onClick={close}>Cancel</Button>}>
      <SaveWatcher />
      <StudentFields today={today} branches={branches} student={student} beltLevels={beltLevels} settingsHref={`/clubs/${clubId}/settings`} />
    </ActionForm>
  );
}
