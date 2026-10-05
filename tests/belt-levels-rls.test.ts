import { before, test } from "node:test";
import assert from "node:assert/strict";
import type { PGlite } from "@electric-sql/pglite";
import { as, createTestDb, createUser } from "./support/db.ts";

// Belt levels and student assignments, against the real migrations.
const A = "00000000-0000-4000-8000-0000000000a3";
const B = "00000000-0000-4000-8000-0000000000b3";

let db: PGlite;
let club: string, otherClub: string;

const rows = (user: string | null, sql: string, params: unknown[] = []) => as(db, user, async (tx) => (await tx.query<Record<string, unknown>>(sql, params)).rows);
const level = async (user: string, c: string, name: string, color = "#ffffff") => String((await rows(user, "select public.create_belt_level($1, $2, $3) as id", [c, name, color]))[0].id);
const student = async (user: string, c: string, name: string, belt: string | null = null) =>
  String((await rows(user, "insert into public.students (club_id, full_name, belt_level_id) values ($1, $2, $3) returning id", [c, name, belt]))[0].id);

before(async () => {
  db = await createTestDb();
  await createUser(db, A);
  await createUser(db, B);
  club = String((await rows(A, "select public.create_club('Seni Club', 'Silat') as id"))[0].id);
  otherClub = String((await rows(B, "select public.create_club('Other Club', 'Karate') as id"))[0].id);
});

test("levels belong to one club: owners manage them, other clubs can't see or use them", async () => {
  const white = await level(A, club, "White belt");
  assert.equal((await rows(B, "select 1 from public.belt_levels where id = $1", [white])).length, 0);
  await assert.rejects(rows(B, "select public.create_belt_level($1, 'Hijack', '#000000')", [club]), /Not authorized/);
  assert.equal((await rows(B, "update public.belt_levels set name = 'X' where id = $1 returning id", [white])).length, 0);
  await assert.rejects(rows(A, "delete from public.belt_levels where id = $1", [white]), /permission denied/);
  await assert.rejects(student(B, otherClub, "Cross Club", white), /foreign key/);
});

test("archived levels stay on existing students but can't be newly assigned", async () => {
  const yellow = await level(A, club, "Yellow belt", "#facc15");
  const s = await student(A, club, "Keeps Yellow", yellow);
  await rows(A, "update public.belt_levels set archived_at = now() where id = $1", [yellow]);
  await assert.rejects(student(A, club, "New Yellow", yellow), /Belt level is archived/);
  // An unrelated edit that re-saves the same archived level is allowed.
  assert.equal((await rows(A, "update public.students set notes = 'x', belt_level_id = $2 where id = $1 returning id", [s, yellow])).length, 1);
  assert.equal((await rows(A, "select belt_level_id from public.students where id = $1", [s]))[0].belt_level_id, yellow);
});

test("moving levels swaps order without changing any student's level", async () => {
  const one = await level(A, club, "Level 1");
  const two = await level(A, club, "Level 2");
  const s = await student(A, club, "Level Two Kid", two);
  await rows(A, "select public.move_belt_level($1, -1)", [two]);
  const order = (await rows(A, "select id from public.belt_levels where club_id = $1 and archived_at is null order by position", [club])).map((r) => r.id);
  assert.ok(order.indexOf(two) < order.indexOf(one));
  assert.equal((await rows(A, "select belt_level_id from public.students where id = $1", [s]))[0].belt_level_id, two);
  await assert.rejects(rows(B, "select public.move_belt_level($1, 1)", [two]), /Not authorized/);
});

test("approval can assign a current level of the same club", async () => {
  const green = await level(A, club, "Green belt", "#16a34a");
  const app = String((await db.query<{ id: string }>("insert into public.student_applications (club_id, full_name) values ($1, 'Approved Green') returning id", [club])).rows[0].id);
  const studentId = String((await rows(A, "select public.approve_student_application($1, null, $2) as id", [app, green]))[0].id);
  assert.equal((await rows(A, "select belt_level_id from public.students where id = $1", [studentId]))[0].belt_level_id, green);
});
