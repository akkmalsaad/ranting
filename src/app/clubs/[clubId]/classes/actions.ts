"use server";
import { revalidatePath } from "next/cache";
import type { PostgrestError } from "@supabase/supabase-js";
import { parseForm, type FormState } from "@/lib/forms";
import { requireClub } from "@/lib/clubs";
import { classCreateSchema, classSessionSchema, classStatuses, idSchema, weeklyDates } from "@/lib/validation";

// Bound club/session ids are untrusted: requireClub re-checks membership, RLS allows only owners
// to create/update, the composite FK keeps a class in its own club's branches, and a trigger
// blocks new/moved classes on archived branches.

const GONE = "This class no longer exists.";

function failure(error: PostgrestError, values: Record<string, string>): FormState {
  if (error.code === "23503" || error.message.includes("Branch is archived")) return { error: "Please correct the highlighted fields.", fieldErrors: { branch_id: ["Choose a current branch of this club."] }, values };
  if (error.code === "23514") return { error: "Please check the dates and times. The end time must be after the start time, and a weekly class needs at least one date in its range.", values };
  if (error.code === "42501") return { error: "Only club owners can change classes.", values };
  return { error: "We couldn't save this class. Please try again.", values };
}

/**
 * After saving, show the class: the month and day of its (first) session, and its branch if a
 * different branch was filtered.
 */
function showSaved(date: string, branchId: string, form: FormData, count = 1, notice?: string): FormState {
  const currentBranch = form.get("current_branch");
  const params: Record<string, string> = { month: date.slice(0, 7), date, page: "" };
  if (typeof currentBranch === "string" && currentBranch && currentBranch !== branchId) params.branch = branchId;
  if (notice) params.notice = notice;
  return { saved: { count, params } };
}

/** Add class: one session, or a weekly series whose sessions are all created in one transaction. */
export async function createClass(clubId: string, _: FormState, form: FormData): Promise<FormState> {
  const { db, club } = await requireClub(clubId);
  const parsed = parseForm(classCreateSchema, form);
  if (!parsed.ok) return parsed.state;
  const { repeat, repeat_until, weekdays, ...session } = parsed.data;

  if (repeat !== "weekly" || !repeat_until) {
    const { error } = await db.from("class_sessions").insert({ club_id: club.id, ...session });
    if (error) return failure(error, parsed.values);
    revalidatePath(`/clubs/${club.id}/classes`);
    return showSaved(session.session_date, session.branch_id, form);
  }

  const { data, error } = await db.rpc("create_class_series", {
    p_club_id: club.id,
    p_branch_id: session.branch_id,
    p_name: session.name,
    p_weekdays: weekdays,
    p_start_date: session.session_date,
    p_end_date: repeat_until,
    p_start_time: session.start_time,
    p_end_time: session.end_time,
    ...(session.instructor_name ? { p_instructor_name: session.instructor_name } : {}),
    ...(session.notes ? { p_notes: session.notes } : {}),
  });
  if (error) return failure(error, parsed.values);
  revalidatePath(`/clubs/${club.id}/classes`);
  // Open the calendar on the first generated session (the start date may not be a chosen weekday).
  const first = weeklyDates(session.session_date, repeat_until, weekdays)[0] ?? session.session_date;
  return showSaved(first, session.branch_id, form, data?.[0]?.new_session_count ?? 1, "series");
}

export async function updateClass(clubId: string, sessionId: string, _: FormState, form: FormData): Promise<FormState> {
  const { db, club } = await requireClub(clubId);
  if (!idSchema.safeParse(sessionId).success) return { error: GONE };
  const parsed = parseForm(classSessionSchema, form);
  if (!parsed.ok) return parsed.state;
  const { data, error } = await db.from("class_sessions").update(parsed.data).eq("id", sessionId).eq("club_id", club.id).select("id");
  if (error) return failure(error, parsed.values);
  if (!data.length) return { error: GONE, values: parsed.values };
  revalidatePath(`/clubs/${club.id}/classes`);
  return showSaved(parsed.data.session_date, parsed.data.branch_id, form);
}

/** Explicit status changes only (Mark completed, Cancel, Reopen); nothing changes automatically. */
export async function setClassStatus(clubId: string, sessionId: string, status: string): Promise<FormState> {
  const { db, club } = await requireClub(clubId);
  if (!idSchema.safeParse(sessionId).success || !classStatuses.some((s) => s === status)) return { error: GONE };
  const { data, error } = await db.from("class_sessions").update({ status }).eq("id", sessionId).eq("club_id", club.id).select("id");
  if (error) return { error: error.code === "42501" ? "Only club owners can change classes." : "We couldn't update this class. Please try again." };
  if (!data.length) return { error: GONE };
  revalidatePath(`/clubs/${club.id}/classes`);
  return { success: status === "cancelled" ? "Class cancelled." : status === "completed" ? "Marked as completed." : "Class reopened." };
}

/**
 * Cancels this class and every later scheduled class in its weekly series (completed and
 * already-cancelled classes are left as they are). Earlier classes are unchanged.
 */
export async function cancelSeriesFrom(clubId: string, sessionId: string): Promise<FormState> {
  const { db, club } = await requireClub(clubId);
  if (!idSchema.safeParse(sessionId).success) return { error: GONE };
  const { data: session, error: loadError } = await db.from("class_sessions").select("series_id, session_date").eq("id", sessionId).eq("club_id", club.id).maybeSingle();
  if (loadError) return { error: "We couldn't update these classes. Please try again." };
  if (!session) return { error: GONE };
  if (!session.series_id) return setClassStatus(club.id, sessionId, "cancelled");
  const { data, error } = await db.from("class_sessions").update({ status: "cancelled" })
    .eq("club_id", club.id).eq("series_id", session.series_id).gte("session_date", session.session_date).eq("status", "scheduled").select("id");
  if (error) return { error: error.code === "42501" ? "Only club owners can change classes." : "We couldn't update these classes. Please try again." };
  revalidatePath(`/clubs/${club.id}/classes`);
  return { success: data.length === 1 ? "1 class cancelled." : `${data.length} classes cancelled.` };
}
