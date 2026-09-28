import { before, describe, test } from "node:test";
import assert from "node:assert/strict";
import type { PGlite } from "@electric-sql/pglite";
import { as, createTestDb, createUser } from "./support/db.ts";

// Tenant-isolation checks run against the real migration in an in-memory Postgres.
const A = "00000000-0000-4000-8000-00000000000a";
const B = "00000000-0000-4000-8000-00000000000b";
const OUTSIDER = "00000000-0000-4000-8000-00000000000c";

type Id = { id: string };
let db: PGlite;
let clubA1: string, clubA2: string, clubB: string;
let branchA1: string, branchA2: string, branchB: string;
let studentA1: string, studentB: string;

const createClub = (user: string, name: string) =>
  as(db, user, async (tx) => (await tx.query<{ id: string }>("select public.create_club($1, 'Silat') as id", [name])).rows[0].id);
const insertBranch = (user: string, club: string, name: string) =>
  as(db, user, async (tx) => (await tx.query<Id>("insert into public.branches (club_id, name) values ($1, $2) returning id", [club, name])).rows[0].id);
const insertStudent = (user: string, club: string, branch: string | null, name: string) =>
  as(db, user, async (tx) => (await tx.query<Id>("insert into public.students (club_id, branch_id, full_name) values ($1, $2, $3) returning id", [club, branch, name])).rows[0].id);
const DENIED = /permission denied|row-level security/;
const CROSS_CLUB = /foreign key constraint/;

const rows = (user: string | null, sql: string, params: unknown[] = []) =>
  as(db, user, async (tx) => (await tx.query(sql, params)).rows);

before(async () => {
  db = await createTestDb();
  await createUser(db, A);
  await createUser(db, B);
  await createUser(db, OUTSIDER);
  clubA1 = await createClub(A, "Seni Club");
  clubA2 = await createClub(A, "Second Club");
  clubB = await createClub(B, "Other Club");
  branchA1 = await insertBranch(A, clubA1, "Central");
  branchA2 = await insertBranch(A, clubA2, "North");
  branchB = await insertBranch(B, clubB, "South");
  studentA1 = await insertStudent(A, clubA1, branchA1, "Aisyah");
  studentB = await insertStudent(B, clubB, branchB, "Bala");
});

describe("club creation", () => {
  test("create_club creates the club and its owner membership together", async () => {
    const members = await rows(A, "select club_id, role from public.club_members where user_id = $1 order by created_at", [A]);
    assert.deepEqual(members.map((m) => (m as { role: string }).role), ["owner", "owner"]);
    const [check] = await db.query<{ orphans: number }>("select count(*)::int as orphans from public.clubs c where not exists (select 1 from public.club_members m where m.club_id = c.id and m.role = 'owner')").then((r) => r.rows);
    assert.equal(check.orphans, 0);
  });

  test("anonymous callers cannot create clubs", async () => {
    await assert.rejects(rows(null, "select public.create_club('Anon Club', 'Silat')"), DENIED);
  });

  test("clubs cannot be inserted directly, bypassing owner creation", async () => {
    await assert.rejects(rows(A, "insert into public.clubs (name, discipline) values ('Direct', 'Silat')"), DENIED);
  });

  test("create_club enforces name rules", async () => {
    await assert.rejects(rows(A, "select public.create_club(' ', 'Silat')"), /check constraint/);
  });
});

describe("cross-club isolation", () => {
  test("a user sees only clubs they belong to, including several of their own", async () => {
    const aClubs = (await rows(A, "select id from public.clubs")).map((r) => (r as Id).id).sort();
    assert.deepEqual(aClubs, [clubA1, clubA2].sort());
    assert.deepEqual((await rows(B, "select id from public.clubs")).map((r) => (r as Id).id), [clubB]);
    assert.equal((await rows(OUTSIDER, "select id from public.clubs")).length, 0);
    assert.equal((await rows(null, "select id from public.clubs").catch(() => [])).length, 0);
  });

  test("user B cannot read user A's memberships, branches or students", async () => {
    assert.equal((await rows(B, "select 1 from public.club_members where club_id = $1", [clubA1])).length, 0);
    assert.equal((await rows(B, "select 1 from public.branches where club_id = $1", [clubA1])).length, 0);
    assert.equal((await rows(B, "select 1 from public.students where id = $1", [studentA1])).length, 0);
  });

  test("user B cannot update or delete user A's club, branches or students", async () => {
    assert.equal((await rows(B, "update public.clubs set name = 'Hijacked' where id = $1 returning id", [clubA1])).length, 0);
    assert.equal((await rows(B, "delete from public.clubs where id = $1 returning id", [clubA1])).length, 0);
    assert.equal((await rows(B, "update public.branches set name = 'Hijacked' where id = $1 returning id", [branchA1])).length, 0);
    assert.equal((await rows(B, "delete from public.branches where id = $1 returning id", [branchA1])).length, 0);
    assert.equal((await rows(B, "update public.students set full_name = 'Hijacked' where id = $1 returning id", [studentA1])).length, 0);
    assert.equal((await rows(B, "delete from public.students where id = $1 returning id", [studentA1])).length, 0);
    const [student] = await db.query<{ full_name: string }>("select full_name from public.students where id = $1", [studentA1]).then((r) => r.rows);
    assert.equal(student.full_name, "Aisyah");
  });

  test("user B cannot insert branches or students into user A's club", async () => {
    await assert.rejects(insertBranch(B, clubA1, "Intruder"), DENIED);
    await assert.rejects(insertStudent(B, clubA1, null, "Intruder"), DENIED);
  });

  test("anonymous requests cannot read or write tenant tables", async () => {
    await assert.rejects(rows(null, "select 1 from public.students"), DENIED);
    await assert.rejects(rows(null, "insert into public.branches (club_id, name) values ($1, 'Anon')", [clubA1]), DENIED);
  });
});

describe("membership and tenant integrity", () => {
  test("nobody can add themselves to a club or change roles directly", async () => {
    await assert.rejects(rows(B, "insert into public.club_members (club_id, user_id, role) values ($1, $2, 'owner')", [clubA1, B]), DENIED);
    await assert.rejects(rows(A, "insert into public.club_members (club_id, user_id, role) values ($1, $2, 'owner')", [clubA1, B]), DENIED);
    await assert.rejects(rows(A, "update public.club_members set user_id = $2 where club_id = $1", [clubA1, B]), DENIED);
    await assert.rejects(rows(A, "delete from public.club_members where club_id = $1", [clubA1]), DENIED);
  });

  test("a student cannot reference a branch from another club, even one the user owns", async () => {
    await assert.rejects(insertStudent(A, clubA1, branchA2, "Cross"), CROSS_CLUB);
    await assert.rejects(insertStudent(A, clubA1, branchB, "Cross"), CROSS_CLUB);
    await assert.rejects(rows(A, "update public.students set branch_id = $2 where id = $1", [studentA1, branchA2]), CROSS_CLUB);
  });

  test("records cannot be moved to another club", async () => {
    await assert.rejects(rows(A, "update public.branches set club_id = $2 where id = $1", [branchA1, clubA2]), DENIED);
    await assert.rejects(rows(A, "update public.students set club_id = $2 where id = $1", [studentA1, clubA2]), DENIED);
  });

  test("new assignments to an archived branch are rejected", async () => {
    const archived = await insertBranch(A, clubA1, "Old Hall");
    await rows(A, "update public.branches set archived_at = now() where id = $1", [archived]);
    await assert.rejects(insertStudent(A, clubA1, archived, "Late"), /Branch is archived/);
  });

  test("active branch names are unique per club; archived names can be reused", async () => {
    await assert.rejects(insertBranch(A, clubA1, "central"), /duplicate key/);
    await insertBranch(A, clubA2, "Central");
    await insertBranch(A, clubA1, "Old Hall");
  });

  test("the student→branch foreign key keeps the name the app's embed hint relies on", async () => {
    const { rows: fks } = await db.query<{ conname: string }>("select conname from pg_constraint where conrelid = 'public.students'::regclass and contype = 'f' and confrelid = 'public.branches'::regclass");
    assert.deepEqual(fks.map((f) => f.conname), ["students_club_id_branch_id_fkey"]);
  });

  test("owners can manage their own records", async () => {
    assert.equal((await rows(A, "update public.students set status = 'inactive' where id = $1 returning id", [studentA1])).length, 1);
    assert.equal((await rows(B, "update public.students set archived_at = now() where id = $1 returning id", [studentB])).length, 1);
  });
});
