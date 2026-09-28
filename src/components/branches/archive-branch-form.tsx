"use client";
import { ActionForm } from "@/components/action-form";
import { setBranchArchived } from "@/app/clubs/[clubId]/branches/actions";

export function ArchiveBranchForm({ clubId, branchId, archived }: { clubId: string; branchId: string; archived: boolean }) {
  // bind keeps this a Server Action reference, so it also works before hydration.
  return <ActionForm action={setBranchArchived.bind(null, clubId, branchId, !archived)} submit={archived ? "Restore branch" : "Archive branch"} danger={!archived} />;
}
