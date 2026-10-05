import { before, describe, test } from "node:test";
import assert from "node:assert/strict";
import type { PGlite } from "@electric-sql/pglite";
import { applyMigration, as, createTestDb, createUser } from "./support/db.ts";
import { resolveBranchColors } from "../src/lib/branch-colors.ts";

// Migration 20261007100000: branch colour + short code, their backfill, constraints and access.
const MIGRATION = "20261007100000_branch_color_short_code.sql";
const A = "00000000-0000-4000-8000-00000000000a";
const B = "00000000-0000-4000-8000-00000000000b";
const OUTSIDER = "00000000-0000-4000-8000-00000000000c";

type Branch = { id: string; club_id: string; name: string; short_code: string | null; color: string | null; updated_at: string };
let db: PGlite;
let clubA: string, clubB: string;
const before_: Record<string, string> = {};

const rows = <T,>(user: string | null, sql: string, params: unknown[] = []) => as(db, user, async (tx) => (await tx.query<T>(sql, params)).rows);
const createClub = async (user: string, name: string) => (await rows<{ id: string }>(user, "select public.create_club($1, 'Silat') as id", [name]))[0].id;
const insertBranch = async (user: string, club: string, name: string) => (await rows<{ id: string }>(user, "insert into public.branches (club_id, name) values ($1, $2) returning id", [club, name]))[0].id;
const DENIED = /permission denied|row-level security/;

before(async () => {
  db = await createTestDb({ before: MIGRATION });
  for (const user of [A, B, OUTSIDER]) await createUser(db, user);
  clubA = await createClub(A, "Seni Club");
  clubB = await createClub(B, "Other Club");
  // Existing branches, created before the migration (oldest first, so duplicates are numbered in this order).
  for (const name of ["Bukit Antarabangsa", "Bukit Aman", "Setapak", "Pusat Latihan Silat Gayong Gombak", "Batu Arang"]) await insertBranch(A, clubA, name);
  await db.exec("update public.branches set archived_at = now() where name = 'Batu Arang'");
  await insertBranch(B, clubB, "Bandar Baru");
  for (const b of (await db.query<{ id: string; t: string }>("select id, updated_at::text as t from public.branches")).rows) before_[b.id] = b.t;
  await applyMigration(db, MIGRATION);
});

const all = async (club: string) => (await db.query<Branch>("select * from public.branches where club_id = $1 order by created_at, id", [club])).rows;

describe("backfill", () => {
  test("short codes come from initials and are unique within the club (archived branches included)", async () => {
    assert.deepEqual((await all(clubA)).map((b) => [b.name, b.short_code]), [
      ["Bukit Antarabangsa", "BA"],
      ["Bukit Aman", "BA2"],
      ["Setapak", "SE"],
      ["Pusat Latihan Silat Gayong Gombak", "PLSG"],
      ["Batu Arang", "BA3"],
    ]);
    // Another club can use the same code.
    assert.deepEqual((await all(clubB)).map((b) => b.short_code), ["BB"]);
  });

  test("colours match what the calendar already showed (the app's id-order fallback)", async () => {
    for (const club of [clubA, clubB]) {
      const branches = await all(club);
      const expected = resolveBranchColors(branches.map((b) => ({ id: b.id })));
      for (const b of branches) assert.equal(b.color, expected.get(b.id), b.name);
    }
  });

  test("the backfill leaves updated_at alone, and the trigger works again afterwards", async () => {
    // Compared as Postgres text (microseconds), not JS dates.
    const stamps = async () => (await db.query<{ id: string; t: string }>("select id, updated_at::text as t from public.branches")).rows;
    for (const b of await stamps()) assert.equal(b.t, before_[b.id]);
    const [b] = await all(clubA);
    await rows(A, "update public.branches set color = 'rose' where id = $1", [b.id]);
    assert.notEqual((await stamps()).find((x) => x.id === b.id)!.t, before_[b.id]);
  });
});

describe("constraints", () => {
  test("short codes are 2–4 uppercase letters or digits", async () => {
    const [b] = await all(clubA);
    for (const bad of ["ba", "B", "ABCDE", "B-A"]) await assert.rejects(rows(A, "update public.branches set short_code = $1 where id = $2", [bad, b.id]), /check constraint/);
    await rows(A, "update public.branches set short_code = 'BKT1' where id = $1", [b.id]);
    await rows(A, "update public.branches set short_code = null where id = $1", [b.id]);
  });

  test("a short code is unique within a club, but other clubs and missing codes don't conflict", async () => {
    const [b] = await all(clubB);
    const se = (await all(clubA)).find((x) => x.short_code === "SE")!;
    await assert.rejects(rows(A, "update public.branches set short_code = 'PLSG' where id = $1", [se.id]), /branches_club_short_code_key/);
    await rows(B, "update public.branches set short_code = 'SE' where id = $1", [b.id]);
    const id1 = await insertBranch(A, clubA, "Kepong");
    const id2 = await insertBranch(A, clubA, "Kajang");
    assert.deepEqual((await db.query("select short_code from public.branches where id in ($1, $2)", [id1, id2])).rows, [{ short_code: null }, { short_code: null }]);
  });

  test("colour must be a palette key", async () => {
    const [b] = await all(clubA);
    await assert.rejects(rows(A, "update public.branches set color = '#147968' where id = $1", [b.id]), /check constraint/);
    await assert.rejects(rows(A, "update public.branches set color = 'magenta' where id = $1", [b.id]), /check constraint/);
  });
});

describe("access", () => {
  test("owners set colour and short code on insert and update", async () => {
    const [created] = await rows<Branch>(A, "insert into public.branches (club_id, name, short_code, color) values ($1, 'Gombak', 'GMB', 'sky') returning *", [clubA]);
    assert.equal(created.short_code, "GMB");
    await rows(A, "update public.branches set short_code = 'GB', color = 'indigo' where id = $1", [created.id]);
    assert.deepEqual((await db.query("select short_code, color from public.branches where id = $1", [created.id])).rows, [{ short_code: "GB", color: "indigo" }]);
  });

  test("other clubs' owners and non-members can't read or change them", async () => {
    const [b] = await all(clubA);
    assert.deepEqual(await rows(B, "select short_code from public.branches where id = $1", [b.id]), []);
    assert.deepEqual(await rows(OUTSIDER, "update public.branches set color = 'teal' where id = $1 returning id", [b.id]), []);
    await assert.rejects(rows(null, "update public.branches set color = 'teal' where id = $1", [b.id]), DENIED);
    assert.equal((await db.query<Branch>("select color from public.branches where id = $1", [b.id])).rows[0].color, "rose");
  });
});
