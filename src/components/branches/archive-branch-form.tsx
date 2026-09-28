"use client";
import { ActionForm } from "@/components/action-form";
import { setBranchArchived } from "@/app/clubs/[clubId]/branches/actions";

export function ArchiveBranchForm({ clubId, branchId, archived }: { clubId: string; branchId: string; archived: boolean }) {
  return <ActionForm action={() => setBranchArchived(clubId, branchId, !archived)} submit={archived ? "Restore branch" : "Archive branch"} danger={!archived} />;
}
