import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { searchTerm } from "@/lib/validation";

type Db = SupabaseClient<Database>;
type Row = Database["public"]["Tables"]["student_applications"]["Row"];

export const APPLICATION_COLUMNS = "id, full_name, date_of_birth, gender, phone, guardian_name, guardian_phone, notes, requested_branch_id, submitted_at, status, reviewed_by, reviewed_at, rejection_reason, approved_branch_id, student_id, submission_id";
export type Application = Pick<Row, "id" | "full_name" | "date_of_birth" | "gender" | "phone" | "guardian_name" | "guardian_phone" | "notes" | "requested_branch_id" | "submitted_at" | "status" | "reviewed_by" | "reviewed_at" | "rejection_reason" | "approved_branch_id" | "student_id" | "submission_id">;
export type DuplicateNote = { message: string; studentId?: string };

type Identity = { id: string; full_name: string; date_of_birth: string | null; guardian_phone: string | null };
const normalise = (value: string | null) => (value ?? "").trim().toLowerCase();

/** Why two records look like the same child: same name AND same date of birth or guardian phone. */
function sameChild(a: Identity, b: Identity) {
  if (normalise(a.full_name) !== normalise(b.full_name)) return null;
  if (a.date_of_birth && a.date_of_birth === b.date_of_birth) return "date of birth";
  if (a.guardian_phone && a.guardian_phone === b.guardian_phone) return "guardian phone";
  return null;
}

/**
 * Flags pending applications that may duplicate a current student or another pending application,
 * for manual review only. Name alone is never enough, and nothing is merged, linked or rejected.
 * Best effort: if the lookup fails, no flags are shown (the review itself is unaffected).
 */
export async function duplicateNotes(db: Db, clubId: string, applications: Application[]) {
  const notes: Record<string, DuplicateNote[]> = {};
  const pending = applications.filter((a) => a.status === "pending");
  // Exact, case-insensitive name matches (ilike without wildcards; searchTerm strips %, _, commas, quotes).
  const names = [...new Set(pending.map((a) => searchTerm(a.full_name)).filter((name) => name.length >= 2))];
  if (!names.length) return notes;
  const filter = names.map((name) => `full_name.ilike."${name}"`).join(",");
  const [students, others] = await Promise.all([
    db.from("students").select("id, full_name, date_of_birth, guardian_phone, archived_at").eq("club_id", clubId).or(filter).limit(200),
    db.from("student_applications").select("id, full_name, date_of_birth, guardian_phone").eq("club_id", clubId).eq("status", "pending").or(filter).limit(200),
  ]);
  for (const application of pending) {
    const found: DuplicateNote[] = [];
    for (const student of students.data ?? []) {
      const reason = sameChild(application, student);
      if (reason) found.push({ message: `${student.archived_at ? "An archived" : "A"} student, ${student.full_name}, has the same name and ${reason}.`, studentId: student.id });
    }
    for (const other of others.data ?? []) {
      if (other.id === application.id) continue;
      const reason = sameChild(application, other);
      if (reason) found.push({ message: `Another pending registration has the same name and ${reason}.` });
    }
    if (found.length) notes[application.id] = found;
  }
  return notes;
}

export type Sibling = { id: string; full_name: string; status: string };

/**
 * Other applications from the same parent submission (children registered together), for the
 * applications shown. One club-scoped query; only owners can read applications (RLS).
 */
export async function siblingsBySubmission(db: Db, clubId: string, applications: Application[]) {
  const siblings: Record<string, Sibling[]> = {};
  const submissions = [...new Set(applications.map((a) => a.submission_id).filter((id): id is string => !!id))];
  if (!submissions.length) return siblings;
  const { data } = await db.from("student_applications").select("id, full_name, status, submission_id, submission_position")
    .eq("club_id", clubId).in("submission_id", submissions).order("submission_position").limit(submissions.length * 10);
  for (const application of applications) {
    if (!application.submission_id) continue;
    const others = (data ?? []).filter((s) => s.submission_id === application.submission_id && s.id !== application.id);
    if (others.length) siblings[application.id] = others.map(({ id, full_name, status }) => ({ id, full_name, status }));
  }
  return siblings;
}
