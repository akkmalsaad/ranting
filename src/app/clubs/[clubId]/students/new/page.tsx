import { listBeltLevels } from "@/lib/belt-levels";
import { clubClient, requireClub } from "@/lib/clubs";
import { todayInMalaysia } from "@/lib/validation";
import { PageHeader } from "@/components/page-header";
import { StudentForm } from "@/components/students/student-form";
import { createStudent } from "../actions";

export const metadata = { title: "Add student" };

export default async function NewStudent({ params, searchParams }: PageProps<"/clubs/[clubId]/students/new">) {
  const { clubId } = await params;
  const requestedBranch = (await searchParams).branch;
  const { db } = await clubClient(clubId);
  const [{ club }, { data: branches, error }, beltLevels] = await Promise.all([
    requireClub(clubId),
    db.from("branches").select("id, name").eq("club_id", clubId).is("archived_at", null).order("name").limit(200),
    listBeltLevels(db, clubId),
  ]);
  if (error) throw new Error("Unable to load branches.");
  return (
    <>
      <PageHeader title="Add student" description={`Register a student with ${club.name}.`} back={{ href: `/clubs/${club.id}/students`, label: "Back to Students" }} />
      <section className="panel max-w-3xl">
        <StudentForm beltLevels={beltLevels} settingsHref={`/clubs/${club.id}/settings`} action={createStudent.bind(null, club.id)} cancelHref={`/clubs/${club.id}/students`} initialBranchId={branches.some((b) => b.id === requestedBranch) ? String(requestedBranch) : undefined} submit="Add student" today={todayInMalaysia()} branches={branches.map((b) => ({ ...b, archived: false }))} />
      </section>
    </>
  );
}
