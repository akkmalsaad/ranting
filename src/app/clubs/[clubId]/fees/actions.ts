"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireClub } from "@/lib/clubs";
import { parseForm, type FormState } from "@/lib/forms";
import { idSchema } from "@/lib/validation";
import { feeBatchSchema, feeEditLockedSchema, feeEditSchema, feeLinkSchema, feePaymentSchema, generateFeesSchema, previewFeesSchema, reasonSchema, safeFeeQuery } from "@/lib/fees/values";

// Fee actions. Each re-checks membership (requireClub) and writes only through the owner-checked
// SECURITY DEFINER functions, whose triggers enforce balances, voids and same-club relationships.
// Creating or generating a charge never creates Finance income; recording a payment creates exactly
// one receipt with its allocation in one transaction.

type RpcError = { code?: string; message?: string };

/** A useful message for a known database rule; unexpected errors are logged (code and message only). */
function feeError(error: RpcError) {
  const m = error.message ?? "";
  if (m.includes("Monthly fee already exists")) return "This student already has a monthly fee for that billing month. Use another fee type for extra charges.";
  if (m.includes("Submission already used")) return "This form was already submitted with different details. Close it and check the fee before trying again.";
  if (m.includes("Fee has payments")) return "This fee has payments, so its amount, type, billing month and branch can't change and it can't be voided. Remove any wrong allocations first.";
  if (m.includes("Fee is voided")) return "This fee is voided and can't be changed or paid.";
  if (m.includes("exceeds the fee balance")) return "That amount is more than the fee's remaining balance. Overpayments aren't supported.";
  if (m.includes("exceeds the receipt")) return "That amount is more than the receipt's unallocated amount.";
  if (m.includes("Student must be active")) return "A selected student is no longer active, or their branch was archived. Reload the page and review the selection.";
  if (m.includes("Use Generate monthly fees")) return "Use Generate monthly fees for monthly training fees.";
  if (m.includes("appear only once")) return "Each student can be selected only once.";
  if (m.includes("between 1 and 500")) return "Select between 1 and 500 students.";
  if (m.includes("current branch")) return "Choose a current branch of this club, or Club-level.";
  if (m.includes("Not authorized") || error.code === "42501") return "You don't have permission to change fees for this club.";
  if (error.code === "23503" || error.code === "P0002") return "That fee, student or receipt no longer exists in this club. Reload the page.";
  if (error.code === "23514") return "Check the amount, dates and details, then try again.";
  console.error("[fees] write failed", { code: error.code, message: error.message });
  return "We couldn't save this. Try again with the same form; it won't create a duplicate.";
}

/** Back to the (validated) list view after a modal action, optionally reopening the fee. */
function back(clubId: string, returnQuery: string, extra: Record<string, string>): never {
  const params = new URLSearchParams(safeFeeQuery(returnQuery));
  for (const [key, value] of Object.entries(extra)) params.set(key, value);
  redirect(`/clubs/${clubId}/fees?${params}`);
}

const refresh = (clubId: string) => revalidatePath(`/clubs/${clubId}`, "layout");
const invalidFee = { error: "This fee couldn't be found. Reload the page." };

export type BatchResult = { ok: true; created: number } | { ok: false; error: string };

/**
 * Add fee (batch): one one-off fee per selected student, all or nothing, idempotent by batch_id
 * (a retry or repeated click returns the same fees). Each fee captures the student's current
 * branch. No Finance income is created until a payment is recorded or income is linked.
 */
export async function addFeeBatch(clubId: string, input: unknown): Promise<BatchResult> {
  const { db, club } = await requireClub(clubId);
  const parsed = feeBatchSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the fee details and selected students." };
  const b = parsed.data;
  const { data, error } = await db.rpc("create_fee_batch", {
    p_batch_id: b.batch_id, p_club_id: club.id, p_fee_type: b.fee_type, p_title: b.title, p_billing_month: `${b.billing_month}-01`,
    p_due_date: b.due_date, p_items: b.items, ...(b.notes ? { p_notes: b.notes } : {}),
  });
  if (error) return { ok: false, error: feeError(error) };
  refresh(club.id);
  return { ok: true, created: data.length };
}

export type PreviewStudent = { id: string; name: string; branch_id: string | null; charged: boolean };
export type PreviewResult = { ok: true; students: PreviewStudent[] } | { ok: false; error: string };

/**
 * Generate step 1: active, current students (optionally of one branch, never on an archived
 * branch) and whether each already has a monthly fee for the month. Pending registrations are not
 * students, so they're never included.
 */
export async function previewMonthlyFees(clubId: string, input: { month: string; branch_id: string }): Promise<PreviewResult> {
  const { db, club } = await requireClub(clubId);
  const parsed = previewFeesSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Choose a billing month and branch." };
  const { month, branch_id } = parsed.data;
  let students = db.from("students").select("id, full_name, branch_id, branch:branches!students_club_id_branch_id_fkey(archived_at)").eq("club_id", club.id).is("archived_at", null).eq("status", "active");
  if (branch_id) students = students.eq("branch_id", branch_id);
  const [list, charged] = await Promise.all([
    students.order("full_name").order("id").limit(501),
    db.from("student_fees").select("student_id").eq("club_id", club.id).eq("fee_type", "monthly").eq("billing_month", `${month}-01`).is("voided_at", null).limit(10000),
  ]);
  if (list.error || charged.error) {
    console.error("[fees] preview failed", { code: (list.error ?? charged.error)?.code, message: (list.error ?? charged.error)?.message });
    return { ok: false, error: "We couldn't load the students. Try again." };
  }
  const eligible = list.data.filter((s) => !s.branch?.archived_at);
  if (eligible.length > 500) return { ok: false, error: "More than 500 students match. Choose a branch to generate fees in smaller groups." };
  const already = new Set(charged.data.map((f) => f.student_id));
  return { ok: true, students: eligible.map((s) => ({ id: s.id, name: s.full_name, branch_id: s.branch_id, charged: already.has(s.id) })) };
}

export type GenerateResult = { ok: true; created: number; skipped: number; ineligible: number } | { ok: false; error: string };

/** Generate step 2: create the reviewed monthly fees. Already-charged students are skipped by the database. */
export async function generateMonthlyFees(clubId: string, input: unknown): Promise<GenerateResult> {
  const { db, club } = await requireClub(clubId);
  const parsed = generateFeesSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the students and amounts." };
  const g = parsed.data;
  const { data, error } = await db.rpc("generate_monthly_fees", { p_club_id: club.id, p_billing_month: `${g.month}-01`, p_due_date: g.due_date, p_title: g.title, p_items: g.items });
  if (error) return { ok: false, error: feeError(error) };
  refresh(club.id);
  const count = (outcome: string) => data.filter((r) => r.outcome === outcome).length;
  return { ok: true, created: count("created"), skipped: count("skipped"), ineligible: count("ineligible") };
}

/** Record payment: one Finance receipt plus its allocation, atomically; idempotent by request_id. */
export async function recordFeePayment(clubId: string, feeId: string, returnQuery: string, _: FormState, form: FormData): Promise<FormState> {
  const { db, club } = await requireClub(clubId);
  if (!idSchema.safeParse(feeId).success) return invalidFee;
  const parsed = parseForm(feePaymentSchema, form);
  if (!parsed.ok) return parsed.state;
  const p = parsed.data;
  const { error } = await db.rpc("record_fee_payment", {
    p_id: p.request_id, p_club_id: club.id, p_fee_id: feeId, p_amount_sen: p.amount, p_paid_on: p.paid_on, p_method: p.method,
    ...(p.reference ? { p_reference: p.reference } : {}), ...(p.notes ? { p_notes: p.notes } : {}),
  });
  if (error) return { values: parsed.values, error: feeError(error) };
  refresh(club.id);
  back(club.id, returnQuery, { fee: feeId, notice: "payment" });
}

/** Link part of an existing Finance receipt to the fee (no new income). */
export async function linkFeeReceipt(clubId: string, feeId: string, returnQuery: string, _: FormState, form: FormData): Promise<FormState> {
  const { db, club } = await requireClub(clubId);
  if (!idSchema.safeParse(feeId).success) return invalidFee;
  const parsed = parseForm(feeLinkSchema, form);
  if (!parsed.ok) return parsed.state;
  const l = parsed.data;
  const { error } = await db.rpc("link_fee_receipt", { p_id: l.request_id, p_club_id: club.id, p_fee_id: feeId, p_receipt_id: l.receipt_id, p_amount_sen: l.amount });
  if (error) return { values: parsed.values, error: feeError(error) };
  refresh(club.id);
  back(club.id, returnQuery, { fee: feeId, notice: "linked" });
}

/** Edit a fee. With unreversed payments only the title, due date and notes are accepted. */
export async function editFee(clubId: string, feeId: string, returnQuery: string, _: FormState, form: FormData): Promise<FormState> {
  const { db, club } = await requireClub(clubId);
  if (!idSchema.safeParse(feeId).success) return invalidFee;
  const [fee, allocations] = await Promise.all([
    db.from("student_fees").select("branch_id, fee_type, billing_month, amount_sen").eq("club_id", club.id).eq("id", feeId).maybeSingle(),
    db.from("fee_allocations").select("id").eq("club_id", club.id).eq("fee_id", feeId).is("reversed_at", null).limit(1),
  ]);
  if (fee.error || allocations.error) return { error: "We couldn't load this fee. Try again." };
  if (!fee.data) return invalidFee;
  const current = fee.data;
  let values: { branch_id: string | null; fee_type: string; billing_month: string; amount_sen: number; title: string; due_date: string; notes: string | null };
  let echoed: Record<string, string>;
  if (allocations.data.length) {
    const parsed = parseForm(feeEditLockedSchema, form);
    if (!parsed.ok) return parsed.state;
    echoed = parsed.values;
    values = { branch_id: current.branch_id, fee_type: current.fee_type, billing_month: current.billing_month, amount_sen: current.amount_sen, ...parsed.data };
  } else {
    const parsed = parseForm(feeEditSchema, form);
    if (!parsed.ok) return parsed.state;
    echoed = parsed.values;
    const e = parsed.data;
    values = { branch_id: e.branch_id, fee_type: e.fee_type, billing_month: `${e.billing_month}-01`, amount_sen: e.amount, title: e.title, due_date: e.due_date, notes: e.notes };
  }
  const { error } = await db.rpc("update_student_fee", {
    p_club_id: club.id, p_fee_id: feeId, p_branch_id: values.branch_id as string, p_fee_type: values.fee_type, p_title: values.title,
    p_billing_month: values.billing_month, p_due_date: values.due_date, p_amount_sen: values.amount_sen, ...(values.notes ? { p_notes: values.notes } : {}),
  });
  if (error) return { values: echoed, error: feeError(error) };
  refresh(club.id);
  back(club.id, returnQuery, { fee: feeId, notice: "fee-updated" });
}

/** Void an unpaid fee with a reason (kept under the Voided filter; never deleted). */
export async function voidFee(clubId: string, feeId: string, returnQuery: string, _: FormState, form: FormData): Promise<FormState> {
  const { db, club } = await requireClub(clubId);
  if (!idSchema.safeParse(feeId).success) return invalidFee;
  const parsed = parseForm(reasonSchema, form);
  if (!parsed.ok) return parsed.state;
  const { error } = await db.rpc("void_student_fee", { p_club_id: club.id, p_fee_id: feeId, p_reason: parsed.data.reason });
  if (error) return { values: parsed.values, error: feeError(error) };
  refresh(club.id);
  back(club.id, returnQuery, { notice: "voided" });
}

/** Remove an allocation: reopens the balance; the Finance receipt is kept (not a refund). */
export async function reverseAllocation(clubId: string, feeId: string, allocationId: string, returnQuery: string, _: FormState, form: FormData): Promise<FormState> {
  const { db, club } = await requireClub(clubId);
  if (!idSchema.safeParse(feeId).success || !idSchema.safeParse(allocationId).success) return invalidFee;
  const parsed = parseForm(reasonSchema, form);
  if (!parsed.ok) return parsed.state;
  const { error } = await db.rpc("reverse_fee_allocation", { p_club_id: club.id, p_allocation_id: allocationId, p_reason: parsed.data.reason });
  if (error) return { values: parsed.values, error: feeError(error) };
  refresh(club.id);
  back(club.id, returnQuery, { fee: feeId, notice: "reversed" });
}
