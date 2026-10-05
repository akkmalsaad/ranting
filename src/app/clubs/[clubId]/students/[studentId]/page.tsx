import { notFound } from "next/navigation";
import { clubClient, requireClub } from "@/lib/clubs";
import { formatDate } from "@/lib/format";
import { idSchema, todayInMalaysia } from "@/lib/validation";
import { PageHeader } from "@/components/page-header";
import { Notice } from "@/components/notice";
import { ArchiveStudentForm } from "@/components/students/archive-student-form";
import { EditStudentDialog, StudentEditProvider } from "@/components/students/edit-student-dialog";
import { StatusBadge } from "@/components/students/status-badge";
import { BeltBadge } from "@/components/belt-swatch";
import { listBeltLevels } from "@/lib/belt-levels";

export const metadata = { title: "Student" };

const LIST_PARAMS = ["view", "q", "branch", "page"] as const;
const recorded = new Intl.DateTimeFormat("en-MY", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kuala_Lumpur" });

/** Label/value pairs in a responsive grid; empty values read "Not provided". */
function Facts({ items }: { items: [label: string, value: React.ReactNode][] }) {
  return (
    <dl className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
      {items.map(([label, value]) => (
        <div key={label} className="min-w-0">
          <dt className="text-[0.8125rem] text-slate-500">{label}</dt>
          <dd className="mt-1 break-words font-medium">{value ?? <span className="font-normal text-slate-400">Not provided</span>}</dd>
        </div>
      ))}
    </dl>
  );
}

/** A titled block inside the profile card, separated from the previous one by a hairline. */
function Block({ id, title, hint, children }: { id: string; title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="border-t border-border px-5 py-6 first:border-t-0 sm:px-6">
      <h2 id={id}>{title}</h2>
      {hint && <p className="mt-0.5 text-[0.8125rem] text-slate-500">{hint}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

/** Read-only student profile. Editing happens in the Edit Student modal. */
export default async function StudentProfile({ params, searchParams }: PageProps<"/clubs/[clubId]/students/[studentId]">) {
  const { clubId, studentId } = await params;
  const sp = await searchParams;
  const { db } = await clubClient(clubId);
  if (!idSchema.safeParse(studentId).success) notFound();
  const [{ club }, { data: student, error }, branches, beltLevels] = await Promise.all([
    requireClub(clubId),
    db.from("students").select("id, full_name, date_of_birth, gender, phone, guardian_name, guardian_phone, branch_id, belt_level_id, status, join_date, notes, archived_at, created_at, updated_at").eq("id", studentId).eq("club_id", clubId).maybeSingle(),
    db.from("branches").select("id, name, archived_at").eq("club_id", clubId).order("name").limit(200),
    listBeltLevels(db, clubId),
  ]);
  if (error || branches.error) throw new Error("Unable to load this student.");
  if (!student) notFound();

  // Back to the list with its filters and page; only the list's own params are carried over.
  const back = new URLSearchParams();
  for (const key of LIST_PARAMS) { const value = sp[key]; if (typeof value === "string" && value) back.set(key, value); }
  const query = back.toString();
  const listHref = `/clubs/${club.id}/students${query ? `?${query}` : ""}`;

  const branch = branches.data.find((b) => b.id === student.branch_id);
  // Looked up by id, so renaming or recolouring a level shows here immediately; archived levels still show.
  const belt = beltLevels.find((level) => level.id === student.belt_level_id);
  const branchLabel = branch ? `${branch.name}${branch.archived_at ? " (archived branch)" : ""}` : null;
  const gender = student.gender === "male" ? "Male" : student.gender === "female" ? "Female" : null;

  return (
    <>
      <PageHeader
        back={{ href: listHref, label: "Back to Students" }}
        title={student.full_name}
        badge={<StatusBadge status={student.status} archived={!!student.archived_at} />}
        description={`${branchLabel ?? "No branch"} · Joined ${formatDate(student.join_date)}`}
        actions={<StudentEditProvider clubId={club.id} today={todayInMalaysia()} branches={branches.data} beltLevels={beltLevels}><EditStudentDialog student={student} /></StudentEditProvider>}
      />
      <Notice code={sp.notice} messages={{ updated: "Student updated." }} />
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_19rem]">
        <div className="min-w-0 rounded-2xl border border-border bg-white">
          <Block id="student-profile" title="Profile">
            <Facts items={[
              ["Current belt / level", belt ? <BeltBadge key="belt" name={belt.name} color={belt.color} stripe={belt.stripe_color} archived={!!belt.archived_at} /> : null],
              ["Branch", branchLabel],
              ["Join date", formatDate(student.join_date)],
              ["Date of birth", student.date_of_birth ? formatDate(student.date_of_birth) : null],
              ["Gender", gender],
              ["Phone", student.phone],
            ]} />
          </Block>
          <Block id="student-guardian" title="Parent / guardian" hint="Contact details only.">
            <Facts items={[
              ["Guardian name", student.guardian_name],
              ["Guardian phone", student.guardian_phone],
            ]} />
          </Block>
          <Block id="student-notes" title="Notes">
            <p className="whitespace-pre-line break-words text-[0.9375rem] leading-6">{student.notes ?? <span className="text-slate-400">Not provided</span>}</p>
          </Block>
        </div>

        <aside className="space-y-6">
          <section aria-labelledby="student-record" className="panel">
            <h2 id="student-record">Record</h2>
            <dl className="mt-4 space-y-3 text-sm">
              <div><dt className="text-[0.8125rem] text-slate-500">Status</dt><dd className="mt-1"><StatusBadge status={student.status} archived={!!student.archived_at} /></dd></div>
              <div><dt className="text-[0.8125rem] text-slate-500">Added</dt><dd className="mt-0.5 font-medium">{recorded.format(new Date(student.created_at))}</dd></div>
              <div><dt className="text-[0.8125rem] text-slate-500">Last updated</dt><dd className="mt-0.5 font-medium">{recorded.format(new Date(student.updated_at))}</dd></div>
              {student.archived_at && <div><dt className="text-[0.8125rem] text-slate-500">Archived on</dt><dd className="mt-0.5 font-medium">{recorded.format(new Date(student.archived_at))}</dd></div>}
            </dl>
          </section>
          <section aria-labelledby="student-archive" className="panel">
            <h2 id="student-archive">{student.archived_at ? "Restore student" : "Archive student"}</h2>
            <p className="mb-5 mt-1.5 text-sm leading-6 text-slate-600">
              {student.archived_at ? "Restoring returns this student to your current student list." : "Archived students are hidden from your current list but keep their full record. Nothing is deleted."}
            </p>
            <ArchiveStudentForm clubId={club.id} studentId={student.id} archived={!!student.archived_at} />
          </section>
        </aside>
      </div>
    </>
  );
}
