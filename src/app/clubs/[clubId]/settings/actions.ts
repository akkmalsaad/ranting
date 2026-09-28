"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { parseForm, type FormState } from "@/lib/forms";
import { requireClub } from "@/lib/clubs";
import { LOGO_MAX_BYTES, checkLogo } from "@/lib/images";
import { clubProfileSchema, clubSettingsSchema, type ClubProfileInput } from "@/lib/validation";
import type { Database } from "@/lib/supabase/database.types";

// Bound club ids are untrusted: requireClub re-checks membership, RLS allows only owners to
// update the club row, and Storage RLS allows only owners to write under `<club_id>/`.

const BUCKET = "club-logos";
type Db = SupabaseClient<Database>;
type Values = Record<string, string>;

/** Uploads a new logo if one was chosen. Returns the new object path, or an error. */
async function uploadLogo(db: Db, clubId: string, form: FormData): Promise<{ path?: string; error?: string }> {
  const file = form.get("logo");
  if (!(file instanceof File) || file.size === 0) return {};
  if (file.size > LOGO_MAX_BYTES) return { error: "Logos must be 2 MB or smaller." };
  const bytes = new Uint8Array(await file.arrayBuffer());
  const check = checkLogo(bytes);
  if (!check.ok) return { error: check.error };
  const path = `${clubId}/logo-${crypto.randomUUID()}.${check.extension}`;
  const { error } = await db.storage.from(BUCKET).upload(path, bytes, { contentType: check.type, upsert: false, cacheControl: "3600" });
  if (error) return { error: "We couldn't upload the logo. Please try again." };
  return { path };
}

/** Saves club details and the logo together; cleans up whichever logo object is no longer used. */
async function saveClub(db: Db, club: { id: string; logo_path: string | null }, details: Partial<ClubProfileInput> & { name?: string; discipline?: string }, form: FormData, values: Values): Promise<FormState | null> {
  const logo = await uploadLogo(db, club.id, form);
  if (logo.error) return { error: "Please correct the highlighted fields.", fieldErrors: { logo: [logo.error] }, values };
  const removeLogo = !logo.path && form.get("remove_logo") === "on";
  const logo_path = logo.path ?? (removeLogo ? null : club.logo_path);
  const { data, error } = await db.from("clubs").update({ ...details, logo_path }).eq("id", club.id).select("id");
  if (error || !data.length) {
    if (logo.path) await db.storage.from(BUCKET).remove([logo.path]);
    return { error: "We couldn't save your club details. Please try again.", values };
  }
  if (club.logo_path && club.logo_path !== logo_path) await db.storage.from(BUCKET).remove([club.logo_path]); // best effort
  revalidatePath(`/clubs/${club.id}`, "layout");
  return null;
}

/** Onboarding step 2 ("Finish"): optional profile only. */
export async function completeClubProfile(clubId: string, _: FormState, form: FormData): Promise<FormState> {
  const { db, club } = await requireClub(clubId);
  const parsed = parseForm(clubProfileSchema, form);
  if (!parsed.ok) return parsed.state;
  const failed = await saveClub(db, club, parsed.data, form, parsed.values);
  if (failed) return failed;
  redirect(`/clubs/${club.id}`);
}

/** Club Settings: required details plus the optional profile. */
export async function updateClubSettings(clubId: string, _: FormState, form: FormData): Promise<FormState> {
  const { db, club } = await requireClub(clubId);
  const parsed = parseForm(clubSettingsSchema, form);
  if (!parsed.ok) return parsed.state;
  const failed = await saveClub(db, club, parsed.data, form, parsed.values);
  if (failed) return failed;
  redirect(`/clubs/${club.id}/settings?notice=saved`);
}
