"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireClub } from "@/lib/clubs";
import { parseForm, type FormState } from "@/lib/forms";
import { transactionSchema } from "@/lib/finance/values";

type Saved = { clubId: string; kind: string; month: string; date: string; branchId: string };

/** Shared by the record page and the modal: validate, then record through the idempotent RPC. */
async function saveTransaction(clubId: string, form: FormData): Promise<{ ok: false; state: FormState } | ({ ok: true } & Saved)> {
  const { db, club } = await requireClub(clubId);
  const parsed = parseForm(transactionSchema, form);
  if (!parsed.ok) return parsed;
  const t = parsed.data;
  const { error } = await db.rpc("record_manual_transaction", { p_id: t.request_id, p_club_id: club.id, p_kind: t.kind, p_branch_id: t.branch_id as string /* null = club-wide; generated RPC arg types omit SQL nullability */, p_amount_sen: t.amount, p_occurred_on: t.occurred_on, p_description: t.description, p_category: t.category });
  if (error) return { ok: false, state: { values: parsed.values, error: error.code === "23505" ? "This submission was already recorded with different details. Check the transaction list before starting a new record." : error.code === "23514" ? "Check the amount, date, category and branch. The branch must belong to this club and must not be archived." : "We couldn't confirm this transaction. Try again with the same form to avoid creating a duplicate." } };
  revalidatePath(`/clubs/${club.id}`, "layout");
  return { ok: true, clubId: club.id, kind: t.kind, month: t.occurred_on.slice(0, 7), date: t.occurred_on, branchId: t.branch_id ?? "" };
}

/** Record transaction page: redirects to the transaction list. */
export async function recordTransaction(clubId: string, _: FormState, form: FormData): Promise<FormState> {
  const result = await saveTransaction(clubId, form);
  if (!result.ok) return result.state;
  redirect(`/clubs/${result.clubId}/finances?kind=${result.kind}&month=${result.month}&notice=recorded`);
}

/**
 * Record income/expense modal (Finance page and dashboard): saves without navigating. Totals,
 * breakdowns and the list refresh via revalidatePath, and the page keeps its period, branch and
 * list filters (first page). `recorded` / `recorded_branch` (the record's date and branch, "" =
 * club-level) let Finance offer "View transaction" when the record falls outside the current view.
 */
export async function addTransaction(clubId: string, _: FormState, form: FormData): Promise<FormState> {
  const result = await saveTransaction(clubId, form);
  if (!result.ok) return result.state;
  return { saved: { count: 1, params: { notice: "recorded", recorded: result.date, recorded_branch: result.branchId, page: "" } } };
}
