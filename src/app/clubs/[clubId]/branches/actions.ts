"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { PostgrestError } from "@supabase/supabase-js";
import { parseForm, type FormState } from "@/lib/forms";
import { requireClub } from "@/lib/clubs";
import { branchSchema, idSchema } from "@/lib/validation";

// Bound club/branch ids come from the client and are untrusted: requireClub re-checks membership,
// and RLS restricts every write to clubs the caller owns.

function failure(error: PostgrestError, values?: Record<string, string>): FormState {
  if (error.code === "23505") return { error: "Please correct the highlighted fields.", fieldErrors: { name: ["Another active branch already uses this name."] }, values };
  return { error: "We couldn't save this branch. Please try again.", values };
}

function done(clubId: string, notice: string): never {
  revalidatePath(`/clubs/${clubId}`, "layout");
  redirect(`/clubs/${clubId}/branches?notice=${notice}`);
}

export async function createBranch(clubId: string, _: FormState, form: FormData): Promise<FormState> {
  const { db, club } = await requireClub(clubId);
  const parsed = parseForm(branchSchema, form);
  if (!parsed.ok) return parsed.state;
  const { error } = await db.from("branches").insert({ club_id: club.id, ...parsed.data });
  if (error) return failure(error, parsed.values);
  done(club.id, "created");
}

export async function updateBranch(clubId: string, branchId: string, _: FormState, form: FormData): Promise<FormState> {
  const { db, club } = await requireClub(clubId);
  if (!idSchema.safeParse(branchId).success) return { error: "This branch no longer exists." };
  const parsed = parseForm(branchSchema, form);
  if (!parsed.ok) return parsed.state;
  const { data, error } = await db.from("branches").update(parsed.data).eq("id", branchId).eq("club_id", club.id).select("id");
  if (error) return failure(error, parsed.values);
  if (!data.length) return { error: "This branch no longer exists." };
  done(club.id, "updated");
}

export async function setBranchArchived(clubId: string, branchId: string, archived: boolean): Promise<FormState> {
  const { db, club } = await requireClub(clubId);
  if (!idSchema.safeParse(branchId).success) return { error: "This branch no longer exists." };
  const { data, error } = await db.from("branches").update({ archived_at: archived === true ? new Date().toISOString() : null }).eq("id", branchId).eq("club_id", club.id).select("id");
  if (error?.code === "23505") return { error: "An active branch already uses this name. Rename one of them before restoring." };
  if (error) return { error: "We couldn't update this branch. Please try again." };
  if (!data.length) return { error: "This branch no longer exists." };
  done(club.id, archived === true ? "archived" : "restored");
}
