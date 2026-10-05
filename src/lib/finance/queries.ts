import "server-only";
import { notFound } from "next/navigation";
import { clubClient } from "@/lib/clubs";
import { idSchema } from "@/lib/validation";
import { categoryLabel, dayPeriod, malaysiaMonth, monthPeriod, transactionCategories, type TransactionKind } from "./values";
import type { ListFilters } from "./view";

/** A branch filter option. `short_code`/`color` are null for branches without them (and before migration 20261007100000). */
export type BranchOption = { id: string; name: string; archived_at: string | null; short_code: string | null; color: string | null };

/**
 * Branch rows with colour and short code. Until migration 20261007100000 is applied those columns
 * don't exist (Postgres 42703), so the original columns are read instead and both are null; the
 * pages keep working as before. The cast covers the dynamic column list, which supabase-js can't type.
 */
async function selectBranchOptions(clubId: string, only?: string): Promise<{ data: BranchOption[] | null; error: unknown; styled?: boolean }> {
  const { db } = await clubClient(clubId);
  const run = (columns: string) => {
    const query = db.from("branches").select(columns).eq("club_id", clubId);
    return only ? query.eq("id", only) : query.order("name").limit(201);
  };
  let result = await run("id, name, archived_at, short_code, color");
  const styled = result.error?.code !== "42703";
  if (!styled) result = await run("id, name, archived_at");
  if (result.error) return { data: null, error: result.error };
  const rows = (result.data ?? []) as unknown as Partial<BranchOption>[];
  return { data: rows.map((b) => ({ short_code: null, color: null, ...b }) as BranchOption), error: null, styled };
}

/**
 * The club's branches (archived included) with short codes and colours, for the branch form's
 * Calendar section. Undefined before migration 20261007100000, which hides that section.
 */
export async function branchPalette(clubId: string): Promise<BranchOption[] | undefined> {
  const { data, error, styled } = await selectBranchOptions(clubId);
  if (error || !data) throw new Error("Unable to load branches.");
  return styled ? data.slice(0, 200) : undefined;
}

export async function branchScope(clubId: string, value: unknown) {
  if (value !== undefined && value !== "" && !idSchema.safeParse(value).success) notFound();
  const id = typeof value === "string" ? value : "";
  const { data, error } = await selectBranchOptions(clubId);
  if (error || !data) throw new Error("Unable to load branches.");
  let selected = data.find((b) => b.id === id);
  // A selected branch remains resolvable even if it lies outside the bounded options list.
  if (id && !selected) {
    const result = await selectBranchOptions(clubId, id);
    if (result.error || !result.data) throw new Error("Unable to load this branch.");
    if (!result.data[0]) notFound();
    selected = result.data[0];
  }
  const options = data.slice(0, 200);
  if (selected && !options.some((b) => b.id === selected.id)) options.push(selected);
  return { id, selected, options, limited: data.length > 200 };
}

/**
 * Totals (SQL sums in sen) for a month ("YYYY-MM", default: current Malaysia month) or a single
 * day ("YYYY-MM-DD"). `category` narrows them to one category or "uncategorised".
 * The period is returned as `month` (start, end, label) for existing callers.
 */
export async function financeSummary(clubId: string, branchId = "", period?: string, category = "") {
  const { db } = await clubClient(clubId);
  const month = !period ? malaysiaMonth() : period.length === 10 ? dayPeriod(period) : monthPeriod(period);
  const { data, error } = await db.rpc("finance_totals", { p_club_id: clubId, p_start: month.start, p_end: month.end, ...(branchId ? { p_branch_id: branchId } : {}), ...(category ? { p_category: category } : {}) });
  // Zero records still return a row of "0" totals, so an error here is never "no transactions".
  if (error || !data?.[0]) return { state: "error" as const, month, totals: null };
  return { state: "ready" as const, month, totals: data[0] };
}

// --- Finance overview ------------------------------------------------------------------------
// Every figure is a database aggregate over all matching records (never a sum of a loaded page),
// returned as text and converted to BigInt sen. The RPCs are security invoker: owner-only RLS
// applies and each re-checks membership and the branch. `range` is [start, end) in Malaysia dates.
// Failures return { ok: false } so the page shows an error instead of a zero.

type Range = { start: string; end: string };
/** Server log for a failed finance RPC: function name, error code and message only (no ids, amounts or descriptions). */
function logFailure(fn: string, error: { code?: string; message?: string } | null) {
  console.error(`[finance] ${fn} failed`, { code: error?.code ?? "no_rows", message: error?.message ?? "No result row" });
}
const scopeArgs = (clubId: string, branchId: string, range: Range) => ({ p_club_id: clubId, p_start: range.start, p_end: range.end, ...(branchId ? { p_branch_id: branchId } : {}) });

/** Income received and expenses paid (the dashboard's finance_totals, so the figures match). */
export async function financeTotals(clubId: string, branchId: string, range: Range) {
  const { db } = await clubClient(clubId);
  const { data, error } = await db.rpc("finance_totals", scopeArgs(clubId, branchId, range));
  if (error || !data?.[0]) { logFailure("finance_totals", error); return { ok: false as const }; }
  return { ok: true as const, income: BigInt(data[0].income_sen), expense: BigInt(data[0].expense_sen) };
}

export type CategoryRow = { category: string | null; label: string; sen: bigint };

/** Totals per category for each kind, largest first ("Uncategorised" = records before categories). */
export async function categoryTotals(clubId: string, branchId: string, range: Range) {
  const { db } = await clubClient(clubId);
  const { data, error } = await db.rpc("finance_category_totals", scopeArgs(clubId, branchId, range));
  if (error) { logFailure("finance_category_totals", error); return { ok: false as const }; }
  const rows = { income: [] as CategoryRow[], expense: [] as CategoryRow[] };
  for (const r of data) {
    if (r.kind !== "income" && r.kind !== "expense") continue;
    const kind = r.kind as TransactionKind;
    const category = r.category as string | null; // null = uncategorised (generated types omit nullability)
    // A value outside today's list (none exist) would still be counted, under its raw name.
    const known = category === null || transactionCategories[kind].some((c) => c.value === category);
    rows[kind].push({ category, label: known ? categoryLabel(kind, category) : (category ?? ""), sen: BigInt(r.total_sen) });
  }
  const order = (a: CategoryRow, b: CategoryRow) => (a.sen === b.sen ? a.label.localeCompare(b.label) : a.sen > b.sen ? -1 : 1);
  return { ok: true as const, income: rows.income.sort(order), expense: rows.expense.sort(order) };
}

/** Whole-club totals per branch (null = club-level records), including archived branches. */
export async function branchTotals(clubId: string, range: Range) {
  const { db } = await clubClient(clubId);
  const { data, error } = await db.rpc("finance_branch_totals", scopeArgs(clubId, "", range));
  if (error) { logFailure("finance_branch_totals", error); return { ok: false as const }; }
  // Generated RPC types omit SQL nullability: branch_id is null for club-level records.
  return { ok: true as const, rows: data.map((r) => ({ branchId: r.branch_id as string | null, income: BigInt(r.income_sen), expense: BigInt(r.expense_sen) })) };
}

/** Totals per month ("YYYY-MM"); months without records are absent (callers show zero). */
export async function monthlyTotals(clubId: string, branchId: string, range: Range) {
  const { db } = await clubClient(clubId);
  const { data, error } = await db.rpc("finance_monthly_totals", scopeArgs(clubId, branchId, range));
  if (error) { logFailure("finance_monthly_totals", error); return { ok: false as const }; }
  return { ok: true as const, byMonth: new Map(data.map((r) => [r.month, { income: BigInt(r.income_sen), expense: BigInt(r.expense_sen) }])) };
}

export type TransactionRow = { id: string; kind: TransactionKind; description: string; category: string | null; branch_id: string | null; occurred_on: string; amount_sen: number; created_at: string };

/**
 * One page of income and expense records (newest date first, then newest recorded, then id, so
 * pages never overlap), plus the count and subtotals of every record matching the list filters.
 */
export async function listTransactions(clubId: string, branchId: string, range: Range, filters: Pick<ListFilters, "kind" | "category" | "search">, page: number, size: number) {
  const { db } = await clubClient(clubId);
  const args = { ...scopeArgs(clubId, branchId, range), ...(filters.kind ? { p_kind: filters.kind } : {}), ...(filters.category ? { p_category: filters.category } : {}), ...(filters.search ? { p_search: filters.search } : {}) };
  const [rows, totals] = await Promise.all([
    db.rpc("finance_transactions", args).order("occurred_on", { ascending: false }).order("created_at", { ascending: false }).order("id").range((page - 1) * size, page * size - 1),
    db.rpc("finance_transaction_totals", args),
  ]);
  if (rows.error || totals.error || !totals.data?.[0]) {
    if (rows.error) logFailure("finance_transactions", rows.error);
    if (totals.error || !totals.data?.[0]) logFailure("finance_transaction_totals", totals.error);
    return { ok: false as const };
  }
  const t = totals.data[0];
  return {
    ok: true as const,
    rows: rows.data as TransactionRow[],
    count: Number(t.record_count),
    income: BigInt(t.income_sen),
    expense: BigInt(t.expense_sen),
  };
}
