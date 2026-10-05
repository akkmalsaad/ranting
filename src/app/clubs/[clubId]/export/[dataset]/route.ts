import type { NextRequest } from "next/server";
import { requireUser } from "@/lib/supabase/server";
import { idSchema, todayInMalaysia } from "@/lib/validation";
import { loadClubCategories } from "@/lib/club-settings";
import { categoryLabel } from "@/lib/finance/values";
import { billingMonthLabel, feeTypeLabel } from "@/lib/fees/values";
import type { FeeRow } from "@/lib/fees/queries";

/**
 * CSV export (Settings → System → Data export): students, finance records or fee records.
 * Everything is read with the signed-in user's session, so RLS limits rows to clubs they belong
 * to (finance and fees: owners only); non-members get 404. Bounded to EXPORT_LIMIT rows per
 * dataset. Cells that a spreadsheet would run as a formula are prefixed with an apostrophe.
 */

const PAGE = 1000;
const EXPORT_LIMIT = 50000;
const DATASETS = ["students", "finance", "fees"] as const;
type Dataset = (typeof DATASETS)[number];
type Cell = string | number | null | undefined;

const money = (sen: number) => `${sen < 0 ? "-" : ""}${Math.floor(Math.abs(sen) / 100)}.${String(Math.abs(sen) % 100).padStart(2, "0")}`;
const stamp = new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Kuala_Lumpur" });
const recordedAt = (iso: string | null) => (iso ? stamp.format(new Date(iso)).replace(",", "") : "");

function cell(value: Cell) {
  let text = value === null || value === undefined ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(text) && typeof value !== "number") text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}
const csv = (header: string[], rows: Cell[][]) => `﻿${[header, ...rows].map((r) => r.map(cell).join(",")).join("\r\n")}\r\n`;

/** Reads every page of a ranged query (up to EXPORT_LIMIT rows). */
async function all<T>(page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>) {
  const rows: T[] = [];
  for (let from = 0; from < EXPORT_LIMIT; from += PAGE) {
    const { data, error } = await page(from, from + PAGE - 1);
    if (error || !data) return null;
    rows.push(...data);
    if (data.length < PAGE) break;
  }
  return rows;
}

export async function GET(_: NextRequest, { params }: RouteContext<"/clubs/[clubId]/export/[dataset]">) {
  const { clubId, dataset: raw } = await params;
  const headers = { "Cache-Control": "private, no-store" };
  const notFound = () => new Response("Not found", { status: 404, headers });
  const dataset = DATASETS.find((d) => d === raw) as Dataset | undefined;
  if (!idSchema.safeParse(clubId).success || !dataset) return notFound();
  const { db } = await requireUser();
  const [{ data: club }, branches] = await Promise.all([
    db.from("clubs").select("id, name").eq("id", clubId).maybeSingle(),
    db.from("branches").select("id, name").eq("club_id", clubId).limit(1000),
  ]);
  if (!club || branches.error) return notFound();
  const branchName = (id: string | null) => (id ? branches.data.find((b) => b.id === id)?.name ?? "Branch" : "");

  let body: string | null = null;
  if (dataset === "students") {
    const [students, belts] = await Promise.all([
      all((from, to) => db.from("students").select("full_name, status, archived_at, branch_id, belt_level_id, date_of_birth, gender, phone, guardian_name, guardian_phone, join_date, notes, created_at").eq("club_id", clubId).order("full_name").order("id").range(from, to)),
      db.from("belt_levels").select("id, name").eq("club_id", clubId).limit(500),
    ]);
    if (students && !belts.error) {
      const belt = (id: string | null) => (id ? belts.data.find((b) => b.id === id)?.name ?? "" : "");
      body = csv(
        ["Full name", "Status", "Archived", "Branch", "Belt / level", "Date of birth", "Gender", "Phone", "Guardian name", "Guardian phone", "Join date", "Notes", "Added"],
        students.map((s) => [s.full_name, s.status === "active" ? "Active" : "Inactive", s.archived_at ? "Yes" : "No", branchName(s.branch_id) || "No branch", belt(s.belt_level_id), s.date_of_birth, s.gender === "male" ? "Male" : s.gender === "female" ? "Female" : "", s.phone, s.guardian_name, s.guardian_phone, s.join_date, s.notes, recordedAt(s.created_at)]),
      );
    }
  } else if (dataset === "finance") {
    const columns = "occurred_on, description, category, branch_id, amount_sen, created_at, id";
    const [income, expenses, { categories }] = await Promise.all([
      all((from, to) => db.from("payments_received").select(columns).eq("club_id", clubId).order("occurred_on").order("id").range(from, to)),
      all((from, to) => db.from("expenses").select(columns).eq("club_id", clubId).order("occurred_on").order("id").range(from, to)),
      loadClubCategories(clubId),
    ]);
    if (income && expenses) {
      const rows = [...income.map((t) => ({ ...t, kind: "income" as const })), ...expenses.map((t) => ({ ...t, kind: "expense" as const }))]
        .sort((a, b) => a.occurred_on.localeCompare(b.occurred_on) || a.created_at.localeCompare(b.created_at));
      body = csv(
        ["Date", "Type", "Description", "Category", "Branch", "Amount (MYR)", "Recorded at"],
        rows.map((t) => [t.occurred_on, t.kind === "income" ? "Income" : "Expense", t.description, categoryLabel(t.kind, t.category, categories), branchName(t.branch_id) || "Club-level", money(t.amount_sen), recordedAt(t.created_at)]),
      );
    }
  } else {
    // Current fees (every billing month) and voided fees, from the same function as the Fees page.
    const [current, voided] = await Promise.all([
      all((from, to) => db.rpc("fee_list", { p_club_id: clubId }).order("billing_month").order("student_name").order("id").range(from, to)),
      all((from, to) => db.rpc("fee_list", { p_club_id: clubId, p_status: "voided" }).order("billing_month").order("student_name").order("id").range(from, to)),
    ]);
    if (current && voided) {
      const status = (f: FeeRow) => (f.status === "voided" ? "Voided" : f.status === "paid" ? "Paid" : f.status === "partial" ? "Partially paid" : "Unpaid");
      body = csv(
        ["Student", "Branch", "Fee", "Type", "Billing period", "Due date", "Amount (MYR)", "Paid (MYR)", "Balance (MYR)", "Status", "Overdue", "Notes", "Created", "Void reason"],
        ([...current, ...voided] as unknown as FeeRow[]).map((f) => [f.student_name, branchName(f.branch_id) || "Club-level", f.title, feeTypeLabel(f.fee_type), billingMonthLabel(f.billing_month), f.due_date, money(f.amount_sen), money(Number(f.paid_sen)), f.status === "voided" ? "" : money(Number(f.balance_sen)), status(f), f.overdue ? "Yes" : "No", f.notes, recordedAt(f.created_at), f.void_reason]),
      );
    }
  }
  if (body === null) return new Response("We couldn't prepare this export. Please try again.", { status: 500, headers });
  const file = `ranting-${dataset}-${todayInMalaysia()}.csv`;
  return new Response(body, { headers: { ...headers, "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${file}"` } });
}
