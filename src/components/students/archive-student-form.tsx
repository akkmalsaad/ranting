"use client";
import { ActionForm } from "@/components/action-form";
import { setStudentArchived } from "@/app/clubs/[clubId]/students/actions";

export function ArchiveStudentForm({ clubId, studentId, archived }: { clubId: string; studentId: string; archived: boolean }) {
  // bind keeps this a Server Action reference, so it also works before hydration.
  return <ActionForm action={setStudentArchived.bind(null, clubId, studentId, !archived)} submit={archived ? "Restore student" : "Archive student"} danger={!archived} />;
}
