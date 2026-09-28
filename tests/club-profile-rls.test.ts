import { before, describe, test } from "node:test";
import assert from "node:assert/strict";
import type { PGlite } from "@electric-sql/pglite";
import { as, createTestDb, createUser } from "./support/db.ts";

// Club profile columns and the club-logos Storage bucket, against the real migrations.
const A = "00000000-0000-4000-8000-0000000000a1";
const B = "00000000-0000-4000-8000-0000000000b1";
const DENIED = /permission denied|row-level security/;

let db: PGlite;
let clubA: string, clubB: string;

const rows = (user: string | null, sql: string, params: unknown[] = []) => as(db, user, async (tx) => (await tx.query(sql, params)).rows);
const createClub = async (user: string, name: string) => ((await rows(user, "select public.create_club($1, 'Silat') as id", [name]))[0] as { id: string }).id;
const upload = (user: string | null, name: string, bucket = "club-logos") =>
  rows(user, "insert into storage.objects (bucket_id, name) values ($1, $2) returning id", [bucket, name]);

before(async () => {
  db = await createTestDb();
  await createUser(db, A);
  await createUser(db, B);
  clubA = await createClub(A, "Seni Club");
  clubB = await createClub(B, "Other Club");
});

describe("club profile", () => {
  test("owners can update their club's profile details", async () => {
    const updated = await rows(A, `update public.clubs set ros_number = 'PPM-001-10-01012020', postcode = '50450', state = 'kuala-lumpur',
      phone = '+60123456789', email = 'info@seni.my', year_founded = 1998 where id = $1 returning id`, [clubA]);
    assert.equal(updated.length, 1);
  });

  test("another user cannot update the profile of a club they don't belong to", async () => {
    assert.equal((await rows(B, "update public.clubs set ros_number = 'HIJACK' where id = $1 returning id", [clubA])).length, 0);
    const [club] = await db.query<{ ros_number: string }>("select ros_number from public.clubs where id = $1", [clubA]).then((r) => r.rows);
    assert.equal(club.ros_number, "PPM-001-10-01012020");
  });

  test("the database rejects malformed profile values", async () => {
    for (const [column, value] of [["postcode", "1234"], ["postcode", "5O450"], ["state", "atlantis"], ["phone", "12ab"], ["email", "no-at-sign"], ["year_founded", 1800]] as const) {
      await assert.rejects(rows(A, `update public.clubs set ${column} = $2 where id = $1`, [clubA, value]), /check constraint/, `${column}=${value}`);
    }
  });

  test("a club's logo path must be inside its own folder", async () => {
    await assert.rejects(rows(A, "update public.clubs set logo_path = $2 where id = $1", [clubA, `${clubB}/logo.png`]), /clubs_logo_path_in_club_folder/);
    assert.equal((await rows(A, "update public.clubs set logo_path = $2 where id = $1 returning id", [clubA, `${clubA}/logo.png`])).length, 1);
  });
});

describe("club-logos storage bucket", () => {
  test("the bucket is private with a 2 MB image-only limit", async () => {
    const [bucket] = (await db.query<{ public: boolean; file_size_limit: number; allowed_mime_types: string[] }>("select public, file_size_limit, allowed_mime_types from storage.buckets where id = 'club-logos'")).rows;
    assert.equal(bucket.public, false);
    assert.equal(Number(bucket.file_size_limit), 2 * 1024 * 1024);
    assert.deepEqual(bucket.allowed_mime_types, ["image/png", "image/jpeg", "image/webp"]);
  });

  test("owners can upload, read, replace and delete logos in their club's folder", async () => {
    assert.equal((await upload(A, `${clubA}/logo-1.png`)).length, 1);
    assert.equal((await rows(A, "select name from storage.objects where bucket_id = 'club-logos'")).length, 1);
    assert.equal((await rows(A, "update storage.objects set metadata = '{}' where name = $1 returning id", [`${clubA}/logo-1.png`])).length, 1);
    assert.equal((await upload(A, `${clubA}/logo-2.png`)).length, 1);
    assert.equal((await rows(A, "delete from storage.objects where name = $1 returning id", [`${clubA}/logo-2.png`])).length, 1);
  });

  test("another user cannot read, overwrite, delete or upload into a club they don't belong to", async () => {
    assert.equal((await rows(B, "select 1 from storage.objects where name like $1", [`${clubA}/%`])).length, 0);
    assert.equal((await rows(B, "update storage.objects set metadata = '{}' where name = $1 returning id", [`${clubA}/logo-1.png`])).length, 0);
    assert.equal((await rows(B, "delete from storage.objects where name = $1 returning id", [`${clubA}/logo-1.png`])).length, 0);
    await assert.rejects(upload(B, `${clubA}/evil.png`), DENIED);
    // B still manages its own club's logo.
    assert.equal((await upload(B, `${clubB}/logo.png`)).length, 1);
    assert.deepEqual((await rows(A, "select name from storage.objects where bucket_id = 'club-logos' order by name")).map((r) => (r as { name: string }).name), [`${clubA}/logo-1.png`]);
  });

  test("objects outside a club folder, anonymous users and other buckets are denied", async () => {
    for (const name of ["logo.png", "not-a-uuid/logo.png", `../${clubA}/logo.png`]) await assert.rejects(upload(A, name), DENIED, name);
    await assert.rejects(upload(A, `${clubA}/logo.png`, "other-bucket"), DENIED);
    await assert.rejects(upload(null, `${clubA}/anon.png`), DENIED);
    assert.equal((await rows(null, "select 1 from storage.objects")).length, 0);
  });
});
