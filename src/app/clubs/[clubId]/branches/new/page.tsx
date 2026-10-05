import { requireClub } from "@/lib/clubs";
import { branchPalette } from "@/lib/finance/queries";
import { PageHeader } from "@/components/page-header";
import { BranchForm } from "@/components/branches/branch-form";
import { createBranch } from "../actions";

export const metadata = { title: "Add branch" };

export default async function NewBranch({ params }: PageProps<"/clubs/[clubId]/branches/new">) {
  const { clubId } = await params;
  const [{ club }, palette] = await Promise.all([requireClub(clubId), branchPalette(clubId)]);
  return (
    <>
      <PageHeader title="Add branch" description={`A new training location for ${club.name}.`} back={{ href: `/clubs/${club.id}/branches`, label: "Back to Branches" }} />
      <section className="panel max-w-2xl"><BranchForm action={createBranch.bind(null, club.id)} cancelHref={`/clubs/${club.id}/branches`} palette={palette} submit="Add branch" /></section>
    </>
  );
}
