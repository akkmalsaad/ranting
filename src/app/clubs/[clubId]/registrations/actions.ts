"use server";
import { revalidatePath } from "next/cache";
import QRCode from "qrcode";
import type { PostgrestError } from "@supabase/supabase-js";
import { parseForm, type FormState } from "@/lib/forms";
import { requireClub } from "@/lib/clubs";
import { siteUrl } from "@/lib/site-url";
import { applicationApprovalSchema, applicationRejectionSchema, idSchema } from "@/lib/validation";

// Bound club/application ids are untrusted: requireClub re-checks membership, and the review
// functions re-check club ownership and lock the application row (retry- and race-safe).

const GONE = "This registration no longer exists or can't be reviewed.";

function reviewError(error: PostgrestError, values: Record<string, string>, action: "approve" | "reject"): FormState {
  if (error.code === "42501") return { error: GONE, values };
  if (error.code === "22023") return { error: action === "approve" ? "This registration was already rejected." : "This registration was already approved.", values };
  if (error.code === "23514" && error.message.includes("belt level")) return { error: "Please correct the highlighted fields.", fieldErrors: { belt_level_id: ["Choose a current belt level of this club."] }, values };
  if (error.code === "23514") return { error: "Please correct the highlighted fields.", fieldErrors: { branch_id: ["Choose a current branch of this club."] }, values };
  return { error: action === "approve" ? "We couldn't approve this registration. Trying again won't create a duplicate student." : "We couldn't reject this registration. Please try again.", values };
}

/** Creates the student from the application (once, however many times it's submitted). */
export async function approveApplication(clubId: string, applicationId: string, _: FormState, form: FormData): Promise<FormState> {
  const { db, club } = await requireClub(clubId);
  if (!idSchema.safeParse(applicationId).success) return { error: GONE };
  const parsed = parseForm(applicationApprovalSchema, form);
  if (!parsed.ok) return parsed.state;
  const { error } = await db.rpc("approve_student_application", {
    p_application_id: applicationId,
    p_branch_id: parsed.data.branch_id as string, // null = no branch; generated RPC arg types omit SQL nullability
    ...(parsed.data.belt_level_id ? { p_belt_level_id: parsed.data.belt_level_id } : {}),
  });
  if (error) return reviewError(error, parsed.values, "approve");
  revalidatePath(`/clubs/${club.id}`, "layout");
  return { saved: { count: 1, params: { notice: "approved" } } };
}

/** Keeps the application with its review details; the reason is internal (owners only). */
export async function rejectApplication(clubId: string, applicationId: string, _: FormState, form: FormData): Promise<FormState> {
  const { db, club } = await requireClub(clubId);
  if (!idSchema.safeParse(applicationId).success) return { error: GONE };
  const parsed = parseForm(applicationRejectionSchema, form);
  if (!parsed.ok) return parsed.state;
  const { error } = await db.rpc("reject_student_application", { p_application_id: applicationId, p_reason: parsed.data.rejection_reason ?? "" });
  if (error) return reviewError(error, parsed.values, "reject");
  revalidatePath(`/clubs/${club.id}`, "layout");
  return { saved: { count: 1, params: { notice: "rejected" } } };
}

// --- Registration links (sharing) ------------------------------------------------------------

export type RegistrationLinkResult = { ok: true; url: string; qr: string; local: boolean } | { ok: false; error: string };

/** Public URL + QR (rendered here on our server, never by an external service) for a link token. */
async function linkResult(token: string): Promise<RegistrationLinkResult> {
  const url = `${siteUrl()}/register/${token}`;
  const qr = await QRCode.toDataURL(url, { errorCorrectionLevel: "M", margin: 2, width: 640, color: { dark: "#071e30", light: "#ffffff" } });
  const local = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:|\/|$)/.test(url);
  return { ok: true, url, qr, local };
}

function linkError(code: string | undefined): RegistrationLinkResult {
  if (code === "23514") return { ok: false, error: "This branch is archived or no longer available. Choose another branch." };
  if (code === "42501") return { ok: false, error: "You don't have access to share links for this club." };
  return { ok: false, error: "We couldn't prepare the registration link. Please try again." };
}

/** The branch's active registration link, created only if it doesn't have one yet (so sharing reuses it). */
export async function getRegistrationLink(clubId: string, branchId: string): Promise<RegistrationLinkResult> {
  const { db, club } = await requireClub(clubId);
  if (!idSchema.safeParse(branchId).success) return { ok: false, error: "Choose a branch." };
  const { data: token, error } = await db.rpc("get_or_create_registration_link", { p_club_id: club.id, p_branch_id: branchId });
  if (error || !token) return linkError(error?.code);
  return linkResult(token);
}

/** Stops the branch's current link (it shows as no longer active) and issues a new one. */
export async function replaceRegistrationLink(clubId: string, branchId: string): Promise<RegistrationLinkResult> {
  const { db, club } = await requireClub(clubId);
  if (!idSchema.safeParse(branchId).success) return { ok: false, error: "Choose a branch." };
  const { data: token, error } = await db.rpc("replace_registration_link", { p_club_id: club.id, p_branch_id: branchId });
  if (error || !token) return linkError(error?.code);
  return linkResult(token);
}
