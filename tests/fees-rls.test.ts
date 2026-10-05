import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import type { PGlite } from "@electric-sql/pglite";
import { as, createTestDb, createUser } from "./support/db.ts";

// Student fees: owner-only access, monthly uniqueness, atomic payments with one Finance receipt,
// no overpayment, receipt linking limits, voids, reversals and immutable history.
const A = "00000000-0000-4000-8000-0000000000f1", B = "00000000-0000-4000-8000-0000000000f2";
let db: PGlite, club: string, other: string, branch: string, student: string, sibling: string, inactive: string, otherStudent: string;
const rows = (user: string | null, sql: string, args: unknown[] = []) => as(db, user, async (tx) => (await tx.query<Record<string, unknown>>(sql, args)).rows);
const one = async (user: string | null, sql: string, args: unknown[] = []) => (await rows(user, sql, args))[0];
const createFee = (user: string, c: string, s: string, options: { id?: string; type?: string; month?: string; amount?: number; branch?: string | null } = {}) =>
  one(user, "select public.create_student_fee($1,$2,$3,$4,$5,'Training fee',$6,'2024-02-10',$7) as id", [options.id ?? crypto.randomUUID(), c, s, options.branch === undefined ? branch : options.branch, options.type ?? "monthly", options.month ?? "2024-02-01", options.amount ?? 10000]);
const pay = (fee: string, amount: number, id = crypto.randomUUID()) => one(A, "select public.record_fee_payment($1,$2,$3,$4,'2024-02-12','cash','REF-1',null) as id", [id, club, fee, amount]);
const balance = async (fee: string) => one(A, "select paid_sen, balance_sen, status from public.fee_list($1, null, null, null, null, false) where id = $2", [club, fee]);

before(async () => {
  db = await createTestDb();
  for (const user of [A, B]) await createUser(db, user);
  club = String((await one(A, "select public.create_club('Fees club','Silat') as id")).id);
  other = String((await one(B, "select public.create_club('Other club','BJJ') as id")).id);
  branch = String((await one(A, "insert into public.branches(club_id,name) values($1,'Central') returning id", [club])).id);
  const add = async (user: string, c: string, name: string, status = "active", b: string | null = branch) => String((await one(user, "insert into public.students(club_id,branch_id,full_name,status) values($1,$2,$3,$4) returning id", [c, b, name, status])).id);
  student = await add(A, club, "Aina Rahman");
  sibling = await add(A, club, "Adam Rahman");
  inactive = await add(A, club, "Old Student", "inactive");
  otherStudent = await add(B, other, "Elsewhere Kid", "active", null);
});
after(async () => { await db.close(); });

test("one monthly fee per student and month; identical retries return the same fee; one-off fees are separate", async () => {
  const id = crypto.randomUUID();
  await createFee(A, club, student, { id });
  assert.equal((await createFee(A, club, student, { id })).id, id);
  await assert.rejects(createFee(A, club, student), /Monthly fee already exists/);
  await assert.rejects(createFee(A, club, student, { id, amount: 1 }), /Submission already used/);
  await createFee(A, club, student, { type: "grading" });
  // Siblings sharing a guardian are separate students with separate fees.
  await createFee(A, club, sibling);
});

test("new charges need an active student of the same club and a current branch", async () => {
  await assert.rejects(createFee(A, club, inactive), /Student must be active/);
  await assert.rejects(createFee(A, club, otherStudent), /foreign key|violates/);
  const archived = String((await one(A, "insert into public.branches(club_id,name,archived_at) values($1,'Closed',now()) returning id", [club])).id);
  await assert.rejects(createFee(A, club, student, { type: "event", branch: archived }), /current branch/);
});

test("generation skips already-charged students (including retries) and reports ineligible ones", async () => {
  const items = JSON.stringify([{ student_id: student, amount_sen: 9000 }, { student_id: sibling, amount_sen: 9000 }, { student_id: inactive, amount_sen: 9000 }]);
  const first = await rows(A, "select outcome from public.generate_monthly_fees($1,'2024-03-01','2024-03-10','Monthly fee',$2::jsonb) order by result_student_id", [club, items]);
  assert.deepEqual(first.map((r) => r.outcome).sort(), ["created", "created", "ineligible"]);
  const retry = await rows(A, "select outcome from public.generate_monthly_fees($1,'2024-03-01','2024-03-10','Monthly fee',$2::jsonb)", [club, items]);
  assert.deepEqual(retry.map((r) => r.outcome).sort(), ["ineligible", "skipped", "skipped"]);
});

test("a payment creates exactly one Finance receipt with the fee's branch and category, atomically and idempotently", async () => {
  const fee = String((await createFee(A, club, student, { type: "registration", month: "2024-04-01", amount: 5000 })).id);
  const receipt = crypto.randomUUID();
  await pay(fee, 2000, receipt);
  await pay(fee, 2000, receipt); // retry
  const income = await rows(A, "select amount_sen, branch_id, category from public.payments_received where id = $1", [receipt]);
  assert.deepEqual(income, [{ amount_sen: 2000, branch_id: branch, category: "registration_fees" }]);
  assert.deepEqual(await balance(fee), { paid_sen: 2000, balance_sen: 3000, status: "partial" });
  // More than the balance is rejected and nothing is recorded.
  const count = Number((await one(A, "select count(*) from public.payments_received where club_id = $1", [club])).count);
  await assert.rejects(pay(fee, 3001), /exceeds the fee balance/);
  assert.equal(Number((await one(A, "select count(*) from public.payments_received where club_id = $1", [club])).count), count);
  await pay(fee, 3000);
  assert.deepEqual(await balance(fee), { paid_sen: 5000, balance_sen: 0, status: "paid" });
});

test("linking an existing receipt is limited by its available amount and the fee balance", async () => {
  const receipt = crypto.randomUUID();
  await one(A, "select public.record_manual_transaction($1,$2,'income',null,6000,'2024-05-02','Cash at the door','monthly_fees')", [receipt, club]);
  const f1 = String((await createFee(A, club, student, { type: "uniform", month: "2024-05-01", amount: 4000 })).id);
  const f2 = String((await createFee(A, club, sibling, { type: "uniform", month: "2024-05-01", amount: 4000 })).id);
  const link = (fee: string, amount: number) => one(A, "select public.link_fee_receipt($1,$2,$3,$4,$5) as id", [crypto.randomUUID(), club, fee, receipt, amount]);
  await assert.rejects(link(f1, 4001), /exceeds the fee balance/);
  await link(f1, 4000);
  await assert.rejects(link(f2, 2001), /exceeds the receipt/);
  await link(f2, 2000);
  assert.equal(Number((await one(A, "select count(*) from public.payments_received where id = $1", [receipt])).count), 1);
});

test("void needs no payments; reversal reopens the balance and keeps the receipt", async () => {
  const unpaid = String((await createFee(A, club, sibling, { type: "event", month: "2024-06-01", amount: 1500 })).id);
  await one(A, "select public.void_student_fee($1,$2,'Charged by mistake')", [club, unpaid]);
  assert.equal((await one(A, "select status from public.fee_list($1,null,null,'voided',null,false) where id = $2", [club, unpaid])).status, "voided");
  await assert.rejects(pay(unpaid, 100), /Fee is voided/);

  const fee = String((await createFee(A, club, sibling, { type: "other", month: "2024-06-01", amount: 1500 })).id);
  const receipt = crypto.randomUUID();
  await pay(fee, 1500, receipt);
  await assert.rejects(one(A, "select public.void_student_fee($1,$2,'Wrong')", [club, fee]), /Fee has payments/);
  await assert.rejects(one(A, "select public.update_student_fee($1,$2,$3,'other','Training fee','2024-06-01','2024-06-10',999,null)", [club, fee, branch]), /Fee has payments/);
  const allocation = String((await one(A, "select id from public.fee_allocations where fee_id = $1", [fee])).id);
  await one(A, "select public.reverse_fee_allocation($1,$2,'Linked to the wrong fee')", [club, allocation]);
  assert.deepEqual(await balance(fee), { paid_sen: 0, balance_sen: 1500, status: "unpaid" });
  assert.equal(Number((await one(A, "select count(*) from public.payments_received where id = $1", [receipt])).count), 1);
});

test("other clubs and anonymous users can't read or write fees; nobody writes the tables directly", async () => {
  const fee = String((await createFee(A, club, student, { type: "event", month: "2024-07-01" })).id);
  assert.equal((await rows(B, "select * from public.student_fees where club_id = $1", [club])).length, 0);
  await assert.rejects(rows(B, "select * from public.fee_list($1)", [club]), /Not authorized/);
  await assert.rejects(rows(B, "select public.record_fee_payment($1,$2,$3,100,'2024-07-02','cash',null,null)", [crypto.randomUUID(), club, fee]), /Not authorized/);
  await assert.rejects(rows(null, "select * from public.student_fees"), /permission denied/);
  for (const sql of ["update public.student_fees set amount_sen = 1 where id = $1", "delete from public.student_fees where id = $1", "delete from public.fee_allocations where fee_id = $1"]) {
    await assert.rejects(rows(A, sql, [fee]), /permission denied/);
  }
});

test("batches create one one-off fee per student atomically, idempotently, and never for monthly fees", async () => {
  const batch = crypto.randomUUID();
  const items = (list: { s: string; a: number }[]) => JSON.stringify(list.map(({ s, a }) => ({ student_id: s, amount_sen: a })));
  const create = (id: string, list: string, type = "yearly") => rows(A, "select * from public.create_fee_batch($1,$2,$3,'Annual fee 2024','2024-01-01','2024-01-31',$4::jsonb,null)", [id, club, type, list]);
  const ok = items([{ s: student, a: 12000 }, { s: sibling, a: 6000 }]);
  assert.equal((await create(batch, ok)).length, 2);
  assert.equal((await create(batch, ok)).length, 2); // retry returns the same fees
  assert.equal(Number((await one(A, "select count(*) from public.student_fees where batch_id = $1", [batch])).count), 2);
  await assert.rejects(create(batch, items([{ s: student, a: 1 }])), /Submission already used/);
  // A second one-off fee for the same student and month is allowed.
  assert.equal((await create(crypto.randomUUID(), items([{ s: student, a: 12000 }]))).length, 1);
  // One ineligible student fails the whole batch.
  const failed = crypto.randomUUID();
  await assert.rejects(create(failed, items([{ s: sibling, a: 100 }, { s: inactive, a: 100 }])), /Student must be active/);
  assert.equal(Number((await one(A, "select count(*) from public.student_fees where batch_id = $1", [failed])).count), 0);
  await assert.rejects(create(crypto.randomUUID(), items([{ s: student, a: 100 }]), "monthly"), /Generate monthly fees/);
  await assert.rejects(create(crypto.randomUUID(), items([{ s: student, a: 100 }, { s: student, a: 100 }])), /only once/);
  await assert.rejects(rows(B, "select * from public.create_fee_batch($1,$2,'grading','Grading','2024-01-01','2024-01-31',$3::jsonb,null)", [crypto.randomUUID(), club, ok]), /Not authorized/);
});
