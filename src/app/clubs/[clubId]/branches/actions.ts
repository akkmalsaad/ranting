"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { PostgrestError } from "@supabase/supabase-js";
import { parseForm, type FormState } from "@/lib/forms";
import { requireClub } from "@/lib/clubs";
import { branchSchema, formatBranchAddress, idSchema, type BranchInput } from "@/lib/validation";

// Bound club/branch ids come from the client and are untrusted: requireClub re-checks membership,
// and RLS restricts every write to clubs the caller owns.

function failure(error: PostgrestError, values?: Record<string, string>): FormState {
  if (error.code === "23505" && error.message.includes("short_code")) return { error: "Please correct the highlighted fields.", fieldErrors: { short_code: ["Another branch in this club already uses this short code."] }, values };
  if (error.code === "23505") return { error: "Please correct the highlighted fields.", fieldErrors: { name: ["Another active branch already uses this name."] }, values };
  return { error: "We couldn't save this branch. Please try again.", values };
}

function done(clubId: string, notice: string): never {
  revalidatePath(`/clubs/${clubId}`, "layout");
  redirect(`/clubs/${clubId}/branches?notice=${notice}`);
}

/**
 * Structured details plus the one-line display `address` shown on branch cards. Short code and
 * colour are only written when the form contained them: the form leaves them out until the
 * database has the columns, so saving never clears or invents them.
 */
function branchRow({ short_code, color, ...branch }: BranchInput, form: FormData) {
  return {
    ...branch,
    address: formatBranchAddress(branch),
    ...(form.has("short_code") ? { short_code } : {}),
    ...(form.has("color") ? { color } : {}),
  };
}

/** Shared by the Add branch page and modal: validate, then insert through RLS. */
async function insertBranch(clubId: string, form: FormData): Promise<{ ok: false; state: FormState } | { ok: true; clubId: string }> {
  const { db, club } = await requireClub(clubId);
  const parsed = parseForm(branchSchema, form);
  if (!parsed.ok) return parsed;
  const { error } = await db.from("branches").insert({ club_id: club.id, ...branchRow(parsed.data, form) });
  if (error) return { ok: false, state: failure(error, parsed.values) };
  return { ok: true, clubId: club.id };
}

/** Add branch page: redirects to the list. */
export async function createBranch(clubId: string, _: FormState, form: FormData): Promise<FormState> {
  const result = await insertBranch(clubId, form);
  if (!result.ok) return result.state;
  done(result.clubId, "created");
}

/** Add branch modal: saves without navigating; the list refreshes via revalidatePath. */
export async function addBranch(clubId: string, _: FormState, form: FormData): Promise<FormState> {
  const result = await insertBranch(clubId, form);
  if (!result.ok) return result.state;
  revalidatePath(`/clubs/${result.clubId}`, "layout");
  return { saved: { count: 1 } };
}

/** Shared by the Edit branch page and modal: validate, then update the existing branch through RLS. */
async function saveBranchChanges(clubId: string, branchId: string, form: FormData): Promise<{ ok: false; state: FormState } | { ok: true; clubId: string }> {
  const { db, club } = await requireClub(clubId);
  if (!idSchema.safeParse(branchId).success) return { ok: false, state: { error: "This branch no longer exists." } };
  const parsed = parseForm(branchSchema, form);
  if (!parsed.ok) return parsed;
  const { data, error } = await db.from("branches").update(branchRow(parsed.data, form)).eq("id", branchId).eq("club_id", club.id).select("id");
  if (error) return { ok: false, state: failure(error, parsed.values) };
  if (!data.length) return { ok: false, state: { error: "This branch no longer exists.", values: parsed.values } };
  return { ok: true, clubId: club.id };
}

/** Edit branch page: redirects to the list. */
export async function updateBranch(clubId: string, branchId: string, _: FormState, form: FormData): Promise<FormState> {
  const result = await saveBranchChanges(clubId, branchId, form);
  if (!result.ok) return result.state;
  done(result.clubId, "updated");
}

/**
 * Edit branch modal (Branches table): saves without navigating. The list refreshes via
 * revalidatePath and keeps its current view/filters; only the notice is added.
 */
export async function editBranch(clubId: string, branchId: string, _: FormState, form: FormData): Promise<FormState> {
  const result = await saveBranchChanges(clubId, branchId, form);
  if (!result.ok) return result.state;
  revalidatePath(`/clubs/${result.clubId}`, "layout");
  return { saved: { count: 1, params: { notice: "updated" } } };
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
