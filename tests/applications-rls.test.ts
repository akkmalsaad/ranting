import { before, test } from "node:test";
import assert from "node:assert/strict";
import type { PGlite } from "@electric-sql/pglite";
import { as, createTestDb, createUser } from "./support/db.ts";

// Registration applications and the approval workflow, against the real migrations.
const A = "00000000-0000-4000-8000-0000000000a2";
const B = "00000000-0000-4000-8000-0000000000b2";
const DENIED = /permission denied|Not authorized/;

let db: PGlite;
let club: string, branch: string;

const rows = (user: string | null, sql: string, params: unknown[] = []) => as(db, user, async (tx) => (await tx.query<Record<string, unknown>>(sql, params)).rows);
// Applications have no public insert path yet, so tests create them as the database owner.
const apply = async (name = "Aisyah Rahman") => String((await db.query<{ id: string }>(
  "insert into public.student_applications (club_id, requested_branch_id, full_name, guardian_name, guardian_phone) values ($1, $2, $3, 'Rahman', '0123456789') returning id", [club, branch, name])).rows[0].id);
const approve = (user: string | null, id: string, b: string | null = branch) => rows(user, "select public.approve_student_application($1, $2) as student_id", [id, b]);
const reject = (user: string | null, id: string, reason = "") => rows(user, "select public.reject_student_application($1, $2) as id", [id, reason]);

before(async () => {
  db = await createTestDb();
  await createUser(db, A);
  await createUser(db, B);
  club = String((await rows(A, "select public.create_club('Seni Club', 'Silat') as id"))[0].id);
  await rows(B, "select public.create_club('Other Club', 'Silat')");
  branch = String((await rows(A, "insert into public.branches (club_id, name) values ($1, 'Central') returning id", [club]))[0].id);
});

test("a pending application is not a student and is visible only to the club's owners", async () => {
  const id = await apply("Pending Child");
  assert.equal((await rows(A, "select 1 from public.students where full_name = 'Pending Child'")).length, 0);
  assert.equal((await rows(A, "select 1 from public.student_applications where id = $1", [id])).length, 1);
  assert.equal((await rows(B, "select 1 from public.student_applications where id = $1", [id])).length, 0);
  await assert.rejects(rows(null, "select 1 from public.student_applications"), /permission denied/);
});

test("nobody can write applications directly or set review fields", async () => {
  const id = await apply("Direct Write");
  await assert.rejects(rows(A, "insert into public.student_applications (club_id, full_name) values ($1, 'X Y')", [club]), /permission denied/);
  await assert.rejects(rows(A, "update public.student_applications set status = 'approved' where id = $1", [id]), /permission denied/);
  await assert.rejects(rows(A, "delete from public.student_applications where id = $1", [id]), /permission denied/);
});

test("approval creates exactly one student, records the review, and is retry-safe", async () => {
  const id = await apply("Approve Once");
  const first = String((await approve(A, id))[0].student_id);
  const second = String((await approve(A, id))[0].student_id);
  assert.equal(second, first);
  assert.equal((await rows(A, "select 1 from public.students where full_name = 'Approve Once'")).length, 1);
  const [app] = await rows(A, "select status, reviewed_by, reviewed_at, student_id, approved_branch_id from public.student_applications where id = $1", [id]);
  assert.equal(app.status, "approved");
  assert.equal(app.reviewed_by, A);
  assert.ok(app.reviewed_at);
  assert.equal(app.student_id, first);
  assert.equal(app.approved_branch_id, branch);
  const [student] = await rows(A, "select club_id, branch_id, status, guardian_phone from public.students where id = $1", [first]);
  assert.deepEqual(student, { club_id: club, branch_id: branch, status: "active", guardian_phone: "0123456789" });
});

test("other clubs' owners cannot approve or reject", async () => {
  const id = await apply("Not Yours");
  await assert.rejects(approve(B, id), DENIED);
  await assert.rejects(reject(B, id), DENIED);
  await assert.rejects(approve(null, id), /permission denied/);
});

test("rejection keeps the application with its reason and blocks later approval", async () => {
  const id = await apply("Reject Me");
  await reject(A, id, "  Duplicate of an existing student  ");
  await reject(A, id); // idempotent
  const [app] = await rows(A, "select status, rejection_reason, student_id from public.student_applications where id = $1", [id]);
  assert.deepEqual(app, { status: "rejected", rejection_reason: "Duplicate of an existing student", student_id: null });
  await assert.rejects(approve(A, id), /already rejected/);
  const approvedId = await apply("Approved First");
  await approve(A, approvedId);
  await assert.rejects(reject(A, approvedId), /already approved/);
});

test("approval requires a current branch of the same club", async () => {
  const id = await apply("Branch Check");
  const archived = String((await rows(A, "insert into public.branches (club_id, name, archived_at) values ($1, 'Old Hall', now()) returning id", [club]))[0].id);
  await assert.rejects(approve(A, id, archived), /current branch/);
  assert.ok((await approve(A, id, null))[0].student_id); // no branch is allowed
});

// --- Registration links and public submission ---------------------------------------------------
const linkFor = async (user: string, b: string) => String((await rows(user, "select public.get_or_create_registration_link($1, $2) as token", [club, b]))[0].token);
const submit = (token: string, id: string, name = "Public Child") => rows(null,
  "select public.submit_student_application($1, $2, $3, null, null, null, 'Parent', '0123456789', null)", [token, id, name]);

test("owners reuse one link per branch; other clubs can't create links for it", async () => {
  const first = await linkFor(A, branch);
  assert.match(first, /^[0-9a-f]{64}$/);
  assert.equal(await linkFor(A, branch), first);
  await assert.rejects(rows(B, "select public.get_or_create_registration_link($1, $2)", [club, branch]), DENIED);
  assert.equal((await rows(B, "select 1 from public.registration_links where club_id = $1", [club])).length, 0);
});

test("a public submission creates only a pending application for the link's own branch, idempotently", async () => {
  const token = await linkFor(A, branch);
  const id = crypto.randomUUID();
  await submit(token, id, "Link Child");
  await submit(token, id, "Link Child"); // retry
  const apps = await rows(A, "select status, requested_branch_id, club_id, reviewed_by, student_id from public.student_applications where full_name = 'Link Child'");
  assert.deepEqual(apps, [{ status: "pending", requested_branch_id: branch, club_id: club, reviewed_by: null, student_id: null }]);
  assert.equal((await rows(A, "select 1 from public.students where full_name = 'Link Child'")).length, 0);
  await assert.rejects(rows(null, "select 1 from public.student_applications"), /permission denied/);
  const [info] = await rows(null, "select * from public.get_registration_link_info($1)", [token]);
  assert.equal(info.state, "active");
});

test("replaced, unknown and archived-branch links can't be used", async () => {
  const old = await linkFor(A, branch);
  const fresh = String((await rows(A, "select public.replace_registration_link($1, $2) as token", [club, branch]))[0].token);
  assert.notEqual(fresh, old);
  await assert.rejects(submit(old, crypto.randomUUID()), /unavailable/);
  assert.equal((await rows(null, "select state from public.get_registration_link_info($1)", [old]))[0].state, "disabled");
  assert.equal((await rows(null, "select state from public.get_registration_link_info($1)", ["0".repeat(64)]))[0].state, "invalid");
  const other = String((await rows(A, "insert into public.branches (club_id, name) values ($1, 'Closing') returning id", [club]))[0].id);
  const closing = await linkFor(A, other);
  await rows(A, "update public.branches set archived_at = now() where id = $1", [other]);
  await assert.rejects(submit(closing, crypto.randomUUID()), /unavailable/);
});

test("a link accepts at most 20 submissions per hour", async () => {
  const b = String((await rows(A, "insert into public.branches (club_id, name) values ($1, 'Busy') returning id", [club]))[0].id);
  const token = await linkFor(A, b);
  for (let i = 0; i < 20; i++) await submit(token, crypto.randomUUID(), `Busy Child ${i}`);
  await assert.rejects(submit(token, crypto.randomUUID(), "One Too Many"), /Too many/);
});

// --- Multi-child submissions ------------------------------------------------------------------------
const submitMany = (token: string, id: string, children: Record<string, unknown>[]) => rows(null,
  "select public.submit_student_applications($1, $2, 'Parent Two', '0198765432', null, $3::jsonb) as count", [token, id, JSON.stringify(children)]);

test("siblings are saved together as separate pending applications, and retries don't duplicate", async () => {
  const b = String((await rows(A, "insert into public.branches (club_id, name) values ($1, 'Family') returning id", [club]))[0].id);
  const token = await linkFor(A, b);
  const id = crypto.randomUUID();
  const kids = [{ full_name: "Sib One", date_of_birth: "2015-01-02", gender: "female" }, { full_name: "Sib Two", gender: "male" }, { full_name: "Sib Three" }];
  assert.equal((await submitMany(token, id, kids))[0].count, 3);
  assert.equal((await submitMany(token, id, kids))[0].count, 3); // retry reports the saved count
  const apps = await rows(A, "select full_name, status, requested_branch_id, submission_id, submission_position, guardian_phone from public.student_applications where submission_id = $1 order by submission_position", [id]);
  assert.deepEqual(apps.map((a) => a.full_name), ["Sib One", "Sib Two", "Sib Three"]);
  for (const a of apps) assert.deepEqual([a.status, a.requested_branch_id, a.guardian_phone], ["pending", b, "0198765432"]);
  // Each sibling is approved independently.
  const [first] = await rows(A, "select id from public.student_applications where submission_id = $1 and submission_position = 1", [id]);
  await approve(A, String(first.id), b);
  assert.deepEqual((await rows(A, "select status from public.student_applications where submission_id = $1 order by submission_position", [id])).map((a) => a.status), ["approved", "pending", "pending"]);
});

test("a submission with any invalid child saves nothing", async () => {
  const b = String((await rows(A, "insert into public.branches (club_id, name) values ($1, 'Atomic') returning id", [club]))[0].id);
  const token = await linkFor(A, b);
  await assert.rejects(submitMany(token, crypto.randomUUID(), [{ full_name: "Good Kid" }, { full_name: "Bad Kid", gender: "other" }]), /check constraint/);
  assert.equal((await rows(A, "select 1 from public.student_applications where full_name in ('Good Kid', 'Bad Kid')")).length, 0);
  await assert.rejects(submitMany(token, crypto.randomUUID(), []), /between 1 and 10/);
});

test("the hourly link limit counts every child; an over-limit submission is rejected in full", async () => {
  const b = String((await rows(A, "insert into public.branches (club_id, name) values ($1, 'Limit') returning id", [club]))[0].id);
  const token = await linkFor(A, b);
  await submitMany(token, crypto.randomUUID(), Array.from({ length: 10 }, (_, i) => ({ full_name: `Batch A ${i}` })));
  await submitMany(token, crypto.randomUUID(), Array.from({ length: 9 }, (_, i) => ({ full_name: `Batch B ${i}` })));
  await assert.rejects(submitMany(token, crypto.randomUUID(), [{ full_name: "Over One" }, { full_name: "Over Two" }]), /Too many/);
  assert.equal((await rows(A, "select 1 from public.student_applications where full_name like 'Over %'")).length, 0);
});
