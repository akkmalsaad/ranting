"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { PostgrestError } from "@supabase/supabase-js";
import { parseForm, type FormState } from "@/lib/forms";
import { requireClub } from "@/lib/clubs";
import { childKeysSchema, idSchema, studentBatchSchema, studentSchema } from "@/lib/validation";

// Bound club/student ids are untrusted: requireClub re-checks membership, RLS scopes every write,
// and the database rejects branches from another club (composite FK) or archived branches (trigger).

const branchError = (message: string, values: Record<string, string>): FormState => ({ error: "Please correct the highlighted fields.", fieldErrors: { branch_id: [message] }, values });

const BELT_ERROR = "Choose a current belt level of this club.";

function failure(error: PostgrestError, values: Record<string, string>): FormState {
  // Belt level from another club (composite FK) or a newly chosen archived level (trigger).
  if (error.message.includes("belt_level") || error.message.includes("Belt level is archived")) {
    return "belt_level_id" in values
      ? { error: "Please correct the highlighted fields.", fieldErrors: { belt_level_id: [BELT_ERROR] }, values }
      : { error: `${BELT_ERROR} Check each child's belt / level.`, values };
  }
  if (error.code === "23503") return branchError("Choose a branch from this club.", values);
  if (error.code === "23514" && error.message.includes("Branch is archived")) return branchError("This branch is archived. Choose an active branch.", values);
  return { error: "We couldn't save this student. Please try again.", values };
}

function done(clubId: string, notice: string): never {
  revalidatePath(`/clubs/${clubId}`, "layout");
  redirect(`/clubs/${clubId}/students?notice=${notice}`);
}

/** Shared by the Add student page and modal: validate, then insert through RLS. */
async function insertStudent(clubId: string, form: FormData): Promise<{ ok: false; state: FormState } | { ok: true; clubId: string; values: Record<string, string> }> {
  const { db, club } = await requireClub(clubId);
  const parsed = parseForm(studentSchema, form);
  if (!parsed.ok) return parsed;
  const { error } = await db.from("students").insert({ club_id: club.id, ...parsed.data });
  if (error) return { ok: false, state: failure(error, parsed.values) };
  return { ok: true, clubId: club.id, values: parsed.values };
}

/** Add student page: redirects to the list. */
export async function createStudent(clubId: string, _: FormState, form: FormData): Promise<FormState> {
  const result = await insertStudent(clubId, form);
  if (!result.ok) return result.state;
  done(result.clubId, "created");
}

/**
 * Add student modal: one or more children (siblings) sharing guardian contact and membership.
 * Every child is validated with the same rules as a single student, then all are created in a
 * single INSERT statement, so either every sibling is saved or none are. Saves without navigating;
 * the list refreshes via revalidatePath.
 */
export async function addStudents(clubId: string, _: FormState, form: FormData): Promise<FormState> {
  const { db, club } = await requireClub(clubId);
  const keys = childKeysSchema.safeParse(form.get("child_keys"));
  if (!keys.success) return { error: "We couldn't read this form. Please reload the page and try again." };
  const parsed = parseForm(studentBatchSchema(keys.data), form);
  if (!parsed.ok) return parsed.state;
  const { error } = await db.from("students").insert(parsed.data.map((student) => ({ club_id: club.id, ...student })));
  if (error) return failure(error, parsed.values);
  revalidatePath(`/clubs/${club.id}`, "layout");
  return { saved: { count: parsed.data.length } };
}

/** Shared by the Edit student page and modal: validate, then update the existing record through RLS. */
async function saveStudentChanges(clubId: string, studentId: string, form: FormData): Promise<{ ok: false; state: FormState } | { ok: true; clubId: string }> {
  const { db, club } = await requireClub(clubId);
  if (!idSchema.safeParse(studentId).success) return { ok: false, state: { error: "This student no longer exists." } };
  const parsed = parseForm(studentSchema, form);
  if (!parsed.ok) return parsed;
  // Only change the belt level when the form included the selector, so a form without it (e.g. no
  // levels configured) never clears an existing assignment.
  const { belt_level_id, ...rest } = parsed.data;
  const changes = form.has("belt_level_id") ? { ...rest, belt_level_id } : rest;
  const { data, error } = await db.from("students").update(changes).eq("id", studentId).eq("club_id", club.id).select("id");
  if (error) return { ok: false, state: failure(error, parsed.values) };
  if (!data.length) return { ok: false, state: { error: "This student no longer exists.", values: parsed.values } };
  return { ok: true, clubId: club.id };
}

/** Edit student page: redirects to the list. */
export async function updateStudent(clubId: string, studentId: string, _: FormState, form: FormData): Promise<FormState> {
  const result = await saveStudentChanges(clubId, studentId, form);
  if (!result.ok) return result.state;
  done(result.clubId, "updated");
}

/**
 * Edit student modal (list rows and student profile): saves without navigating. The current page
 * refreshes via revalidatePath and keeps its filters and pagination; only the notice is added.
 */
export async function editStudent(clubId: string, studentId: string, _: FormState, form: FormData): Promise<FormState> {
  const result = await saveStudentChanges(clubId, studentId, form);
  if (!result.ok) return result.state;
  revalidatePath(`/clubs/${result.clubId}`, "layout");
  return { saved: { count: 1, params: { notice: "updated" } } };
}

export async function setStudentArchived(clubId: string, studentId: string, archived: boolean): Promise<FormState> {
  const { db, club } = await requireClub(clubId);
  if (!idSchema.safeParse(studentId).success) return { error: "This student no longer exists." };
  const archive = archived === true;
  const { data, error } = await db.from("students").update({ archived_at: archive ? new Date().toISOString() : null }).eq("id", studentId).eq("club_id", club.id).select("id");
  if (error) return { error: "We couldn't update this student. Please try again." };
  if (!data.length) return { error: "This student no longer exists." };
  done(club.id, archive ? "archived" : "restored");
}
