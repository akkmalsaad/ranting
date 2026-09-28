import { requireClub } from "@/lib/clubs";
import { PageHeader } from "@/components/page-header";
import { BranchForm } from "@/components/branches/branch-form";
import { createBranch } from "../actions";

export const metadata = { title: "Add branch" };

export default async function NewBranch({ params }: PageProps<"/clubs/[clubId]/branches/new">) {
  const { club } = await requireClub((await params).clubId);
  return (
    <>
      <PageHeader title="Add branch" description={`A new training location for ${club.name}.`} />
      <section className="panel max-w-2xl"><BranchForm action={createBranch.bind(null, club.id)} cancelHref={`/clubs/${club.id}/branches`} submit="Add branch" /></section>
    </>
  );
}
