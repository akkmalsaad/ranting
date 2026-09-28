"use client";
import { ActionForm } from "@/components/action-form";
import { setStudentArchived } from "@/app/clubs/[clubId]/students/actions";

export function ArchiveStudentForm({ clubId, studentId, archived }: { clubId: string; studentId: string; archived: boolean }) {
  return <ActionForm action={() => setStudentArchived(clubId, studentId, !archived)} submit={archived ? "Restore student" : "Archive student"} danger={!archived} />;
}
