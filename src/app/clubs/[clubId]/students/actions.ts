"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { PostgrestError } from "@supabase/supabase-js";
import { parseForm, type FormState } from "@/lib/forms";
import { requireClub } from "@/lib/clubs";
import { idSchema, studentSchema } from "@/lib/validation";

// Bound club/student ids are untrusted: requireClub re-checks membership, RLS scopes every write,
// and the database rejects branches from another club (composite FK) or archived branches (trigger).

const branchError = (message: string, values: Record<string, string>): FormState => ({ error: "Please correct the highlighted fields.", fieldErrors: { branch_id: [message] }, values });

function failure(error: PostgrestError, values: Record<string, string>): FormState {
  if (error.code === "23503") return branchError("Choose a branch from this club.", values);
  if (error.code === "23514" && error.message.includes("Branch is archived")) return branchError("This branch is archived. Choose an active branch.", values);
  return { error: "We couldn't save this student. Please try again.", values };
}

function done(clubId: string, notice: string): never {
  revalidatePath(`/clubs/${clubId}`, "layout");
  redirect(`/clubs/${clubId}/students?notice=${notice}`);
}

export async function createStudent(clubId: string, _: FormState, form: FormData): Promise<FormState> {
  const { db, club } = await requireClub(clubId);
  const parsed = parseForm(studentSchema, form);
  if (!parsed.ok) return parsed.state;
  const { error } = await db.from("students").insert({ club_id: club.id, ...parsed.data });
  if (error) return failure(error, parsed.values);
  done(club.id, "created");
}

export async function updateStudent(clubId: string, studentId: string, _: FormState, form: FormData): Promise<FormState> {
  const { db, club } = await requireClub(clubId);
  if (!idSchema.safeParse(studentId).success) return { error: "This student no longer exists." };
  const parsed = parseForm(studentSchema, form);
  if (!parsed.ok) return parsed.state;
  const { data, error } = await db.from("students").update(parsed.data).eq("id", studentId).eq("club_id", club.id).select("id");
  if (error) return failure(error, parsed.values);
  if (!data.length) return { error: "This student no longer exists." };
  done(club.id, "updated");
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
