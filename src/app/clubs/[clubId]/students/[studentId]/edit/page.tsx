import { notFound } from "next/navigation";
import { listBeltLevels } from "@/lib/belt-levels";
import { clubClient, requireClub } from "@/lib/clubs";
import { idSchema, todayInMalaysia } from "@/lib/validation";
import { PageHeader } from "@/components/page-header";
import { StudentForm } from "@/components/students/student-form";
import { ArchiveStudentForm } from "@/components/students/archive-student-form";
import { updateStudent } from "../../actions";

export const metadata = { title: "Edit student" };

export default async function EditStudent({ params }: PageProps<"/clubs/[clubId]/students/[studentId]/edit">) {
  const { clubId, studentId } = await params;
  const { db } = await clubClient(clubId);
  if (!idSchema.safeParse(studentId).success) notFound();
  const [{ club }, { data: student, error }, branches, beltLevels] = await Promise.all([
    requireClub(clubId),
    db.from("students").select("id, full_name, date_of_birth, gender, phone, guardian_name, guardian_phone, branch_id, belt_level_id, status, join_date, notes, archived_at").eq("id", studentId).eq("club_id", clubId).maybeSingle(),
    db.from("branches").select("id, name, archived_at").eq("club_id", clubId).order("name").limit(200),
    listBeltLevels(db, clubId),
  ]);
  if (error || branches.error) throw new Error("Unable to load this student.");
  if (!student) notFound();
  // Active branches, plus the student's current branch if it has since been archived.
  const options = branches.data.filter((b) => !b.archived_at || b.id === student.branch_id).map((b) => ({ id: b.id, name: b.name, archived: !!b.archived_at }));
  return (
    <>
      <PageHeader title="Edit student" description={student.full_name} back={{ href: `/clubs/${club.id}/students`, label: "Back to Students" }} />
      <div className="max-w-3xl space-y-6">
        <section className="panel">
          <StudentForm action={updateStudent.bind(null, club.id, student.id)} cancelHref={`/clubs/${club.id}/students`} submit="Save changes" today={todayInMalaysia()} branches={options} student={student} beltLevels={beltLevels} settingsHref={`/clubs/${club.id}/settings`} />
        </section>
        <section className="panel">
          <h2>{student.archived_at ? "Restore student" : "Archive student"}</h2>
          <p className="mb-5 mt-2 text-sm leading-6 text-slate-600">
            {student.archived_at ? "Restoring returns this student to your current student list." : "Archived students are hidden from your current list but keep their full record. Nothing is deleted."}
          </p>
          <ArchiveStudentForm clubId={club.id} studentId={student.id} archived={!!student.archived_at} />
        </section>
      </div>
    </>
  );
}
