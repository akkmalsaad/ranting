"use server";
import { revalidatePath } from "next/cache";
import type { PostgrestError } from "@supabase/supabase-js";
import { parseForm, type FormState } from "@/lib/forms";
import { requireClub } from "@/lib/clubs";
import { beltLevelSchema, idSchema } from "@/lib/validation";

// Bound club/level ids are untrusted: requireClub re-checks membership; RLS (owner-only updates)
// and the owner-checked create/move functions enforce ownership in the database.

const GONE = "This belt level no longer exists.";

function failure(error: PostgrestError, values?: Record<string, string>): FormState {
  if (error.code === "23505") return { error: "Please correct the highlighted fields.", fieldErrors: { name: ["Another active level already uses this name."] }, values };
  if (error.code === "42501") return { error: "Only club owners can change belt levels.", values };
  return { error: "We couldn't save this belt level. Please try again.", values };
}

const refresh = (clubId: string) => revalidatePath(`/clubs/${clubId}`, "layout");

export async function createBeltLevel(clubId: string, _: FormState, form: FormData): Promise<FormState> {
  const { db, club } = await requireClub(clubId);
  const parsed = parseForm(beltLevelSchema, form);
  if (!parsed.ok) return parsed.state;
  const { error } = await db.rpc("create_belt_level", { p_club_id: club.id, p_name: parsed.data.name, p_color: parsed.data.color, ...(parsed.data.stripe_color ? { p_stripe_color: parsed.data.stripe_color } : {}) });
  if (error) return failure(error, parsed.values);
  refresh(club.id);
  return { saved: { count: 1, params: { notice: "belt-created" } } };
}

/** Name, colour and stripe; students reference the level by id, so every display updates. */
export async function updateBeltLevel(clubId: string, levelId: string, _: FormState, form: FormData): Promise<FormState> {
  const { db, club } = await requireClub(clubId);
  if (!idSchema.safeParse(levelId).success) return { error: GONE };
  const parsed = parseForm(beltLevelSchema, form);
  if (!parsed.ok) return parsed.state;
  const { data, error } = await db.from("belt_levels").update({ name: parsed.data.name, color: parsed.data.color, stripe_color: parsed.data.stripe_color }).eq("id", levelId).eq("club_id", club.id).select("id");
  if (error) return failure(error, parsed.values);
  if (!data.length) return { error: GONE, values: parsed.values };
  refresh(club.id);
  return { saved: { count: 1, params: { notice: "belt-updated" } } };
}

/** Swaps with the neighbouring active level; student assignments are unaffected. */
export async function moveBeltLevel(clubId: string, levelId: string, direction: number): Promise<FormState> {
  const { db, club } = await requireClub(clubId);
  if (!idSchema.safeParse(levelId).success || (direction !== -1 && direction !== 1)) return { error: GONE };
  const { error } = await db.rpc("move_belt_level", { p_level_id: levelId, p_direction: direction });
  if (error) return { error: error.code === "42501" ? "Only club owners can reorder belt levels." : "We couldn't move this level. Please try again." };
  refresh(club.id);
  return {};
}

/** Archived levels stay on students who have them but can't be newly assigned. Nothing is deleted. */
export async function setBeltLevelArchived(clubId: string, levelId: string, archived: boolean): Promise<FormState> {
  const { db, club } = await requireClub(clubId);
  if (!idSchema.safeParse(levelId).success) return { error: GONE };
  const { data, error } = await db.from("belt_levels").update({ archived_at: archived === true ? new Date().toISOString() : null }).eq("id", levelId).eq("club_id", club.id).select("id");
  if (error?.code === "23505") return { error: "An active level already uses this name. Rename one of them before restoring." };
  if (error) return { error: "We couldn't update this level. Please try again." };
  if (!data.length) return { error: GONE };
  refresh(club.id);
  return {};
}
