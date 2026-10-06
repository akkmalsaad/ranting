import "server-only";
import { clubClient } from "@/lib/clubs";
import type { FeeFilters } from "./values";

// Fee reads. Lists and totals are database aggregates (fee_list / fee_summary, security invoker,
// owner-only RLS) over every matching fee, never sums of a loaded page. Failures return
// { ok: false } so the page shows an error rather than zero.

function logFailure(fn: string, error: { code?: string; message?: string } | null) {
  console.error(`[fees] ${fn} failed`, { code: error?.code ?? "no_rows", message: error?.message ?? "No result row" });
}

const scopeArgs = (clubId: string, f: FeeFilters) => ({
  p_club_id: clubId,
  ...(f.outstanding ? { p_outstanding: true } : { p_month: `${f.month}-01` }),
  ...(f.branch ? { p_branch_id: f.branch } : {}),
});

export type FeeRow = {
  id: string; student_id: string; student_name: string; student_archived: boolean; branch_id: string | null; fee_type: string; title: string;
  billing_month: string; due_date: string; amount_sen: number; paid_sen: number; balance_sen: number; status: "unpaid" | "partial" | "paid" | "voided";
  overdue: boolean; notes: string | null; created_at: string; voided_at: string | null; void_reason: string | null;
};

/** One page of fees (due date, then student, then id, so pages never overlap) and the total count. */
export async function listFees(clubId: string, f: FeeFilters, page: number, size: number) {
  const { db } = await clubClient(clubId);
  const { data, error, count } = await db.rpc("fee_list", { ...scopeArgs(clubId, f), ...(f.status ? { p_status: f.status } : {}), ...(f.search ? { p_search: f.search } : {}) }, { count: "exact" })
    .order("due_date").order("student_name").order("id").range((page - 1) * size, page * size - 1);
  if (error) { logFailure("fee_list", error); return { ok: false as const }; }
  return { ok: true as const, rows: data as FeeRow[], count: count ?? 0 };
}

/** Charged, collected, outstanding and overdue (subset of outstanding) for the billing scope and branch. */
export async function feeSummary(clubId: string, f: FeeFilters) {
  const { db } = await clubClient(clubId);
  const { data, error } = await db.rpc("fee_summary", scopeArgs(clubId, f));
  if (error || !data?.[0]) { logFailure("fee_summary", error); return { ok: false as const }; }
  const r = data[0];
  return { ok: true as const, count: Number(r.fee_count), charged: BigInt(r.charged_sen), collected: BigInt(r.collected_sen), outstanding: BigInt(r.outstanding_sen), overdue: BigInt(r.overdue_sen) };
}

const STUDENT_PAGE = 1000;

/**
 * How many different students have an outstanding balance (> 0) in the scope, using the same
 * `fee_list` scope as the list and summary (so a "billed for October" fee counts exactly as on the
 * Fees page, whatever its type). Reads fee and student ids only, paged so a large scope is counted
 * in full. PostgREST can only order an RPC's result by a selected column, so `id` is selected too.
 */
export async function outstandingStudentCount(clubId: string, f: FeeFilters) {
  const { db } = await clubClient(clubId);
  const students = new Set<string>();
  for (let from = 0; from < 50 * STUDENT_PAGE; from += STUDENT_PAGE) {
    const { data, error } = await db.rpc("fee_list", { ...scopeArgs(clubId, f), p_outstanding: true }).select("id, student_id").order("id").range(from, from + STUDENT_PAGE - 1);
    if (error) { logFailure("fee_list (outstanding students)", error); return { ok: false as const }; }
    for (const row of data) students.add(row.student_id);
    if (data.length < STUDENT_PAGE) break;
  }
  return { ok: true as const, students: students.size };
}

/** Active, current students (for new charges), with their current branch and belt level. */
export async function chargeableStudents(clubId: string) {
  const { db } = await clubClient(clubId);
  const { data, error } = await db.from("students").select("id, full_name, branch_id, belt_level_id").eq("club_id", clubId).is("archived_at", null).eq("status", "active").order("full_name").order("id").limit(2000);
  if (error) { logFailure("students", error); return null; }
  return data;
}

export type FeeAllocation = {
  id: string; amount_sen: number; source: string; method: string | null; reference: string | null; notes: string | null; created_at: string;
  reversed_at: string | null; reversal_reason: string | null; receipt: { id: string; occurred_on: string; description: string; branch_id: string | null } | null;
};

/** A fee with its student, paid/balance and payment history (reversed allocations included, marked). */
export async function loadFee(clubId: string, feeId: string) {
  const { db } = await clubClient(clubId);
  const [fee, allocations] = await Promise.all([
    db.from("student_fees").select("id, student_id, branch_id, fee_type, title, billing_month, due_date, amount_sen, notes, created_at, updated_at, voided_at, void_reason").eq("club_id", clubId).eq("id", feeId).maybeSingle(),
    db.from("fee_allocations").select("id, receipt_id, amount_sen, source, method, reference, notes, created_at, reversed_at, reversal_reason").eq("club_id", clubId).eq("fee_id", feeId).order("created_at").order("id").limit(200),
  ]);
  if (fee.error || allocations.error) { logFailure("loadFee", fee.error ?? allocations.error); return { ok: false as const }; }
  if (!fee.data) return { ok: true as const, fee: null };
  const receiptIds = [...new Set(allocations.data.map((a) => a.receipt_id))];
  const [student, receipts] = await Promise.all([
    db.from("students").select("id, full_name, archived_at, status").eq("club_id", clubId).eq("id", fee.data.student_id).maybeSingle(),
    receiptIds.length ? db.from("payments_received").select("id, occurred_on, description, branch_id").eq("club_id", clubId).in("id", receiptIds) : Promise.resolve({ data: [], error: null }),
  ]);
  if (student.error || receipts.error || !student.data) { logFailure("loadFee", student.error ?? receipts.error); return { ok: false as const }; }
  const byId = new Map((receipts.data ?? []).map((r) => [r.id, r]));
  const history: FeeAllocation[] = allocations.data.map((a) => ({ ...a, receipt: byId.get(a.receipt_id) ?? null }));
  const paid = history.filter((a) => !a.reversed_at).reduce((sum, a) => sum + a.amount_sen, 0);
  return { ok: true as const, fee: { ...fee.data, paid_sen: paid, balance_sen: fee.data.amount_sen - paid }, student: student.data, history };
}

export type LinkableReceipt = { id: string; occurred_on: string; description: string; category: string | null; branch_id: string | null; amount_sen: number; allocated_sen: number; available_sen: number };

/** Club receipts with an unallocated amount (newest 50, optional description search). */
export async function linkableReceipts(clubId: string, search: string) {
  const { db } = await clubClient(clubId);
  const { data, error } = await db.rpc("fee_linkable_receipts", { p_club_id: clubId, ...(search ? { p_search: search } : {}) });
  if (error) { logFailure("fee_linkable_receipts", error); return null; }
  return data as LinkableReceipt[];
}
