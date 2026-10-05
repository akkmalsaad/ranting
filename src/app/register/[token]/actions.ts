"use server";
import { redirect } from "next/navigation";
import { parseForm, type FormState } from "@/lib/forms";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/supabase/database.types";
import { MAX_REGISTRATION_CHILDREN, childKeysSchema, idSchema, publicRegistrationBatchSchema, registrationTokenSchema } from "@/lib/validation";

const UNAVAILABLE = "This registration link is no longer active. Please ask the club for a new link.";
const CHECK = "Please check the details and try again.";

/**
 * Public registration submit (no login) for one or more children. The club and branch come only
 * from the validated link inside submit_student_applications; nothing in the form can choose them
 * or set any review field. All children are saved together or not at all, and the submission id
 * (created when the form was shown) makes a retried submit return the original result.
 */
export async function submitRegistration(token: string, submissionId: string, _: FormState, form: FormData): Promise<FormState> {
  if (!registrationTokenSchema.safeParse(token).success || !idSchema.safeParse(submissionId).success) return { error: UNAVAILABLE };
  // Honeypot: hidden from people; automated form-fillers tend to complete it. Pretend success.
  const trap = form.get("website");
  if (typeof trap === "string" && trap.trim()) redirect(`/register/${token}/submitted`);
  const keys = childKeysSchema.safeParse(form.get("child_keys"));
  if (!keys.success || keys.data.length > MAX_REGISTRATION_CHILDREN) return { error: CHECK };
  const parsed = parseForm(publicRegistrationBatchSchema(keys.data), form);
  if (!parsed.ok) return parsed.state;
  const r = parsed.data;
  const db = await createClient();
  const { data: count, error } = await db.rpc("submit_student_applications", {
    p_token: token,
    p_submission_id: submissionId,
    p_guardian_name: r.guardian_name,
    p_guardian_phone: r.guardian_phone,
    p_notes: r.notes as string, // nullable in SQL; generated RPC arg types omit SQL nullability
    p_children: r.children as Json,
  });
  if (error) {
    const values = parsed.values;
    if (error.code === "22023") return { error: UNAVAILABLE, values };
    if (error.code === "54000") return { error: "This club is receiving a lot of registrations right now. Please try again later.", values };
    if (error.code === "23505") return { error: "This form was already used. Please reload the page and submit again.", values };
    if (["23514", "23502", "22007", "22008", "22P02"].includes(error.code)) return { error: CHECK, values };
    // Unexpected failure: log only the code and the database's message text (never the token,
    // `details`/`hint`, which can echo row values, or any submitted personal data).
    console.error("[registration] submit failed", { code: error.code, message: error.message?.slice(0, 200) });
    return { error: "We couldn't submit your registration. Please try again.", values };
  }
  redirect(`/register/${token}/submitted?n=${count}`);
}
