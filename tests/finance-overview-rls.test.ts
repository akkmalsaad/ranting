import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import type { PGlite } from "@electric-sql/pglite";
import { as, createTestDb, createUser } from "./support/db.ts";

// Finance overview functions: owner-only, branch-checked, and every aggregate reconciles with
// finance_totals (the dashboard's figures) for the same club, dates and branch.
const A = "00000000-0000-4000-8000-0000000000a1", B = "00000000-0000-4000-8000-0000000000b1", OUT = "00000000-0000-4000-8000-0000000000c1";
let db: PGlite, club: string, other: string, central: string, north: string, otherBranch: string;
const rows = (user: string | null, sql: string, args: unknown[] = []) => as(db, user, async (tx) => (await tx.query<Record<string, unknown>>(sql, args)).rows);
const record = (c: string, kind: "income" | "expense", amount: number, date: string, branch: string | null, category: string | null, description = "Overview record") =>
  rows(A, "select public.record_manual_transaction($1,$2,$3,$4,$5,$6,$7,$8)", [crypto.randomUUID(), c, kind, branch, amount, date, description, category ?? (kind === "income" ? "monthly_fees" : "rent")]);

before(async () => {
  db = await createTestDb();
  for (const user of [A, B, OUT]) await createUser(db, user);
  club = String((await rows(A, "select public.create_club('Overview club','Silat') as id"))[0].id);
  other = String((await rows(B, "select public.create_club('Other club','BJJ') as id"))[0].id);
  central = String((await rows(A, "insert into public.branches(club_id,name) values($1,'Central') returning id", [club]))[0].id);
  north = String((await rows(A, "insert into public.branches(club_id,name) values($1,'North') returning id", [club]))[0].id);
  otherBranch = String((await rows(B, "insert into public.branches(club_id,name) values($1,'Elsewhere') returning id", [other]))[0].id);
  await record(club, "income", 10000, "2024-01-31", central, "monthly_fees", "January fees");
  await record(club, "income", 2500, "2024-02-01", north, "grading_fees", "Grading February");
  await record(club, "income", 700, "2024-02-15", null, "events", "Club event tickets");
  await record(club, "expense", 4000, "2024-02-10", central, "rent", "Hall rental");
  await record(club, "expense", 300, "2024-02-29", null, "events", "Event medals");
  await record(club, "expense", 999, "2024-03-01", north, "utilities", "March power"); // outside February
  // A historical record without a category (only possible before categories existed).
  await db.query("insert into public.payments_received(id,club_id,branch_id,amount_sen,occurred_on,description,created_by) values(gen_random_uuid(),$1,$2,50,'2024-02-20','Old receipt',$3)", [club, north, A]);
  await rows(B, "select public.record_manual_transaction($1,$2,'income',$3,123,'2024-02-10','Other club fees','monthly_fees')", [crypto.randomUUID(), other, otherBranch]);
  // North is archived later; its history must stay in every breakdown.
  await rows(A, "update public.branches set archived_at=now() where id=$1", [north]);
});
after(async () => { await db.close(); });

const FEB: [string, string] = ["2024-02-01", "2024-03-01"];

test("category totals include Uncategorised and reconcile with finance_totals", async () => {
  const cats = await rows(A, "select kind, category, total_sen from public.finance_category_totals($1,$2,$3) order by kind, total_sen::bigint desc", [club, ...FEB]);
  assert.deepEqual(cats, [
    { kind: "expense", category: "rent", total_sen: "4000" },
    { kind: "expense", category: "events", total_sen: "300" },
    { kind: "income", category: "grading_fees", total_sen: "2500" },
    { kind: "income", category: "events", total_sen: "700" },
    { kind: "income", category: null, total_sen: "50" },
  ]);
  const [totals] = await rows(A, "select * from public.finance_totals($1,$2,$3)", [club, ...FEB]);
  assert.deepEqual(totals, { income_sen: "3250", expense_sen: "4300" });
});

test("branch totals cover archived branches and club-level records and add up to the overview", async () => {
  const branches = await rows(A, "select branch_id, income_sen, expense_sen from public.finance_branch_totals($1,$2,$3)", [club, ...FEB]);
  const by = new Map(branches.map((r) => [r.branch_id as string | null, r]));
  assert.deepEqual(by.get(central), { branch_id: central, income_sen: "0", expense_sen: "4000" });
  assert.deepEqual(by.get(north), { branch_id: north, income_sen: "2550", expense_sen: "0" });
  assert.deepEqual(by.get(null), { branch_id: null, income_sen: "700", expense_sen: "300" });
  const sum = (key: string) => branches.reduce((s, r) => s + BigInt(String(r[key])), BigInt(0)).toString();
  assert.equal(sum("income_sen"), "3250");
  assert.equal(sum("expense_sen"), "4300");
});

test("monthly totals group by calendar month and omit empty months", async () => {
  assert.deepEqual(await rows(A, "select * from public.finance_monthly_totals($1,'2024-01-01','2024-04-01')", [club]), [
    { month: "2024-01", income_sen: "10000", expense_sen: "0" },
    { month: "2024-02", income_sen: "3250", expense_sen: "4300" },
    { month: "2024-03", income_sen: "0", expense_sen: "999" },
  ]);
  assert.deepEqual(await rows(A, "select * from public.finance_monthly_totals($1,'2024-01-01','2024-04-01',$2)", [club, central]), [
    { month: "2024-01", income_sen: "10000", expense_sen: "0" },
    { month: "2024-02", income_sen: "0", expense_sen: "4000" },
  ]);
});

test("transaction list filters by kind, category (incl. uncategorised), branch and literal search", async () => {
  const list = (args: unknown[]) => rows(A, "select description from public.finance_transactions($1,$2,$3,$4,$5,$6,$7) order by occurred_on desc, created_at desc, id", [club, ...FEB, ...args]);
  assert.equal((await list([null, null, null, null])).length, 6);
  assert.deepEqual((await list([null, "expense", "events", null])).map((r) => r.description), ["Event medals"]);
  assert.deepEqual((await list([null, "income", "uncategorised", null])).map((r) => r.description), ["Old receipt"]);
  assert.deepEqual((await list([central, null, null, null])).map((r) => r.description), ["Hall rental"]);
  assert.deepEqual((await list([null, null, null, "EVENT"])).map((r) => r.description).sort(), ["Club event tickets", "Event medals"]);
  // % and _ are literal text, not wildcards.
  assert.equal((await list([null, null, null, "%"])).length, 0);
  const [t] = await rows(A, "select * from public.finance_transaction_totals($1,$2,$3,null,null,null,'event')", [club, ...FEB]);
  assert.deepEqual({ ...t, record_count: Number(t.record_count) }, { record_count: 2, income_sen: "700", expense_sen: "300" });
});

test("non-owners, other clubs' branches, bad kinds and empty ranges are rejected", async () => {
  for (const user of [B, OUT, null]) {
    for (const sql of [
      "select * from public.finance_transactions($1,'2024-02-01','2024-03-01')",
      "select * from public.finance_transaction_totals($1,'2024-02-01','2024-03-01')",
      "select * from public.finance_category_totals($1,'2024-02-01','2024-03-01')",
      "select * from public.finance_branch_totals($1,'2024-02-01','2024-03-01')",
      "select * from public.finance_monthly_totals($1,'2024-02-01','2024-03-01')",
    ]) await assert.rejects(rows(user, sql, [club]), /Not authorized|permission denied/);
  }
  await assert.rejects(rows(A, "select * from public.finance_transactions($1,'2024-02-01','2024-03-01',$2)", [club, otherBranch]), /Invalid branch/);
  await assert.rejects(rows(A, "select * from public.finance_transactions($1,'2024-02-01','2024-03-01',null,'invoice')", [club]), /Invalid transaction kind/);
  await assert.rejects(rows(A, "select * from public.finance_category_totals($1,'2024-03-01','2024-03-01')", [club]), /Invalid date range/);
});
