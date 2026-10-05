import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { PGlite, type Transaction } from "@electric-sql/pglite";

const root = join(import.meta.dirname, "..", "..");
const migrationsDir = join(root, "supabase", "migrations");

/**
 * Boots an in-memory Postgres with the Supabase shim and every migration applied in order. With
 * `before`, stops before that migration file so a test can seed rows and then run it with
 * `applyMigration` (to exercise backfills).
 */
export async function createTestDb({ before }: { before?: string } = {}) {
  const db = new PGlite();
  await db.exec(readFileSync(join(import.meta.dirname, "supabase-shim.sql"), "utf8"));
  for (const file of readdirSync(migrationsDir).filter((f) => f.endsWith(".sql")).sort()) {
    if (before && file >= before) break;
    await applyMigration(db, file);
  }
  return db;
}

export async function applyMigration(db: PGlite, file: string) {
  await db.exec(readFileSync(join(migrationsDir, file), "utf8"));
}

export async function createUser(db: PGlite, id: string) {
  await db.query("insert into auth.users (id, email) values ($1, $2)", [id, `${id}@test.local`]);
  return id;
}

/** Runs fn as a Supabase API request: `authenticated` with a JWT subject, or `anon` when userId is null. */
export async function as<T>(db: PGlite, userId: string | null, fn: (tx: Transaction) => Promise<T>) {
  return db.transaction(async (tx) => {
    await tx.exec(`set local role ${userId ? "authenticated" : "anon"}`);
    await tx.query("select set_config('request.jwt.claim.sub', $1, true)", [userId ?? ""]);
    return fn(tx);
  });
}
