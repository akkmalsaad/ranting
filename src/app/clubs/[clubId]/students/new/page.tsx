import { clubClient, requireClub } from "@/lib/clubs";
import { todayInMalaysia } from "@/lib/validation";
import { PageHeader } from "@/components/page-header";
import { StudentForm } from "@/components/students/student-form";
import { createStudent } from "../actions";

export const metadata = { title: "Add student" };

export default async function NewStudent({ params }: PageProps<"/clubs/[clubId]/students/new">) {
  const { clubId } = await params;
  const { db } = await clubClient(clubId);
  const [{ club }, { data: branches, error }] = await Promise.all([
    requireClub(clubId),
    db.from("branches").select("id, name").eq("club_id", clubId).is("archived_at", null).order("name").limit(200),
  ]);
  if (error) throw new Error("Unable to load branches.");
  return (
    <>
      <PageHeader title="Add student" description={`Register a student with ${club.name}.`} />
      <section className="panel max-w-3xl">
        <StudentForm action={createStudent.bind(null, club.id)} cancelHref={`/clubs/${club.id}/students`} submit="Add student" today={todayInMalaysia()} branches={branches.map((b) => ({ ...b, archived: false }))} />
      </section>
    </>
  );
}
