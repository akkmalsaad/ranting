import { notFound } from "next/navigation";
import { clubClient, requireClub } from "@/lib/clubs";
import { branchPalette } from "@/lib/finance/queries";
import { idSchema } from "@/lib/validation";
import { PageHeader } from "@/components/page-header";
import { BranchForm } from "@/components/branches/branch-form";
import { ArchiveBranchForm } from "@/components/branches/archive-branch-form";
import { StatusBadge } from "@/components/students/status-badge";
import { updateBranch } from "../../actions";

export const metadata = { title: "Edit branch" };

export default async function EditBranch({ params }: PageProps<"/clubs/[clubId]/branches/[branchId]/edit">) {
  const { clubId, branchId } = await params;
  const { db } = await clubClient(clubId);
  if (!idSchema.safeParse(branchId).success) notFound();
  const [{ club }, { data: branch, error }, students, palette] = await Promise.all([
    requireClub(clubId),
    db.from("branches").select("id, name, address_line1, address_line2, postcode, city, state, coach_name, coach_phone, coach_role, coach_email, archived_at").eq("id", branchId).eq("club_id", clubId).maybeSingle(),
    db.from("students").select("id", { count: "exact", head: true }).eq("club_id", clubId).eq("branch_id", branchId).is("archived_at", null),
    branchPalette(clubId),
  ]);
  if (error || students.error) throw new Error("Unable to load this branch.");
  if (!branch) notFound();
  const assigned = students.count ?? 0;
  return (
    <>
      <PageHeader title="Edit branch" description={branch.name} back={{ href: `/clubs/${club.id}/branches`, label: "Back to Branches" }} badge={<StatusBadge status="active" archived={!!branch.archived_at} />} />
      <div className="max-w-2xl space-y-6">
        <section className="panel"><BranchForm action={updateBranch.bind(null, club.id, branch.id)} branch={branch} branchId={branch.id} palette={palette} cancelHref={`/clubs/${club.id}/branches`} submit="Save changes" /></section>
        <section className="panel">
          <h2>{branch.archived_at ? "Restore branch" : "Archive branch"}</h2>
          <p className="mb-5 mt-1.5 text-sm leading-6 text-slate-600">
            {branch.archived_at
              ? "Restoring makes this branch available for new students again."
              : `Archived branches are hidden and can't take new students. ${assigned === 1 ? "1 student keeps" : `${assigned} students keep`} this branch on their record. Nothing is deleted.`}
          </p>
          <ArchiveBranchForm clubId={club.id} branchId={branch.id} archived={!!branch.archived_at} />
        </section>
      </div>
    </>
  );
}
