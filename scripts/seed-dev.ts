// Development seed: a test owner account plus two sample clubs (one branch, four branches) with a
// realistic class schedule, so pages can be checked logged in. Sample data only: every club name
// starts with "Dev ·". Never run it against a project with real clubs unless that is intended.
//
// Run: npm run seed:dev   (reads .env.local; variable names are listed in .env.example)
//   NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
//   SUPABASE_SECRET_KEY      server-only; used here only to create the test user already confirmed
//                            (Auth requires email confirmation, and a sign-up would email a fake address)
//   DEV_SEED_OWNER_EMAIL, DEV_SEED_OWNER_PASSWORD
//   DEV_SEED_PROJECT_REF     must match the project in the URL ("local" for a local stack on
//                            localhost/127.0.0.1), so it can't run against another project
//
// Idempotent: re-running keeps the user (its password is reset to the env value), reuses the clubs
// by name, adds missing branches by name, and only adds classes to a club that has none. After the
// user exists, everything runs as that user through RLS, exactly like the app.
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../src/lib/supabase/database.types.ts";

type BranchSeed = { name: string; short_code: string | null; color: string | null };
type ClubSeed = { name: string; discipline: string; branches: BranchSeed[] };

const CLUBS: ClubSeed[] = [
  { name: "Dev · Seni Silat Satu Cawangan", discipline: "Silat", branches: [{ name: "Bukit Antarabangsa", short_code: "BA", color: "teal" }] },
  {
    name: "Dev · Seni Silat Empat Cawangan",
    discipline: "Silat",
    branches: [
      { name: "Bukit Antarabangsa", short_code: "BA", color: "teal" },
      { name: "Taman Melawati Ampang", short_code: "TMA", color: "rose" },
      { name: "Setapak", short_code: "SE", color: "amber" },
      // No saved code or colour: shows the fallback colour and the name-if-it-fits rule.
      { name: "Gombak Utara", short_code: null, color: null },
    ],
  },
];

function env(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing ${name} in .env.local (see .env.example).`);
  return value;
}

const url = env("NEXT_PUBLIC_SUPABASE_URL");
const host = new URL(url).hostname;
const ref = host === "localhost" || host === "127.0.0.1" ? "local" : host.split(".")[0];
if (env("DEV_SEED_PROJECT_REF") !== ref) throw new Error(`DEV_SEED_PROJECT_REF doesn't match the project in NEXT_PUBLIC_SUPABASE_URL (${ref}). Refusing to seed.`);
if (process.env.NODE_ENV === "production") throw new Error("Refusing to seed with NODE_ENV=production.");
const email = env("DEV_SEED_OWNER_EMAIL");
const password = env("DEV_SEED_OWNER_PASSWORD");
if (password.length < 12) throw new Error("DEV_SEED_OWNER_PASSWORD must be at least 12 characters.");

const noSession = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient<Database>(url, env("SUPABASE_SECRET_KEY"), noSession);
const db = createClient<Database>(url, env("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"), noSession);

/** Creates the owner already confirmed (no email is sent), or resets an existing one's password. */
async function ensureOwner() {
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: "Dev Owner" } });
  if (!created.error) return "created";
  if (created.error.code !== "email_exists") throw created.error;
  for (let page = 1; ; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    const user = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (user) {
      const updated = await admin.auth.admin.updateUserById(user.id, { password, email_confirm: true });
      if (updated.error) throw updated.error;
      return "updated";
    }
    if (data.users.length < 1000) throw new Error("The owner email exists but the user wasn't found.");
  }
}

// --- Dates (Malaysia wall clock, plain YYYY-MM-DD strings) ----------------------------------
const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kuala_Lumpur", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const addDays = (date: string, days: number) => { const d = new Date(`${date}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + days); return d.toISOString().slice(0, 10); };
const isoWeekday = (date: string) => new Date(`${date}T00:00:00Z`).getUTCDay() || 7; // 1 = Mon … 7 = Sun
const firstOfMonth = `${today.slice(0, 7)}-01`;
const endOfNextMonth = (() => { const d = new Date(`${firstOfMonth}T00:00:00Z`); d.setUTCMonth(d.getUTCMonth() + 2, 0); return d.toISOString().slice(0, 10); })();

type SessionRow = Database["public"]["Tables"]["class_sessions"]["Insert"];

/** This month and next: a weekly pattern per branch, a busy day, a class late today, and past classes split between completed and not closed. */
function schedule(clubId: string, branchIds: string[]): SessionRow[] {
  const weekly: [branch: number, weekdays: number[], start: string, end: string, name: string][] = branchIds.length === 1
    ? [[0, [1, 3, 5], "20:30", "22:30", "Silibus Asas"], [0, [6], "09:00", "11:00", "Kelas Remaja"]]
    : [[0, [1, 3, 5], "20:30", "22:30", "Silibus Asas"], [1, [2, 4], "21:00", "23:00", "Silibus Jurulatih"], [2, [6], "09:30", "11:00", "Junior Kids"], [3, [7], "08:00", "10:00", "Latihan Pagi"]];
  const rows: SessionRow[] = [];
  let n = 0;
  const add = (branch: number, date: string, start: string, end: string, name: string) => {
    n++;
    const status = n % 9 === 4 ? "cancelled" : date < today && n % 2 === 0 ? "completed" : "scheduled";
    rows.push({ club_id: clubId, branch_id: branchIds[branch % branchIds.length], session_date: date, start_time: start, end_time: end, name, instructor_name: "Cikgu Hafiz", status });
  };
  for (let date = firstOfMonth; date <= endOfNextMonth; date = addDays(date, 1)) {
    for (const [branch, days, start, end, name] of weekly) if (days.includes(isoWeekday(date))) add(branch, date, start, end, name);
  }
  const busy = addDays(today, 3);
  add(0, busy, "07:00", "08:00", "Early Birds");
  add(1, busy, "11:00", "13:00", "Kelas Wanita");
  add(2, busy, "17:00", "18:30", "Junior Kids");
  add(0, today, "23:00", "23:59", "Kelas Malam");
  return rows;
}

async function seedClub(seed: ClubSeed, userId: string) {
  const existing = await db.from("clubs").select("id").eq("name", seed.name).maybeSingle();
  if (existing.error) throw existing.error;
  let clubId = existing.data?.id;
  if (!clubId) {
    const created = await db.rpc("create_club", { p_name: seed.name, p_discipline: seed.discipline });
    if (created.error) throw created.error;
    clubId = created.data;
  }

  const current = await db.from("branches").select("id, name").eq("club_id", clubId);
  if (current.error) throw current.error;
  const byName = new Map(current.data.map((b) => [b.name.toLowerCase(), b.id]));
  const missing = seed.branches.filter((b) => !byName.has(b.name.toLowerCase()));
  if (missing.length) {
    const inserted = await db.from("branches").insert(missing.map((b) => ({ club_id: clubId, name: b.name, short_code: b.short_code, color: b.color, created_by: userId }))).select("id, name");
    if (inserted.error) throw inserted.error;
    for (const b of inserted.data) byName.set(b.name.toLowerCase(), b.id);
  }
  const branchIds = seed.branches.map((b) => byName.get(b.name.toLowerCase())!);

  const classes = await db.from("class_sessions").select("id", { count: "exact", head: true }).eq("club_id", clubId);
  if (classes.error) throw classes.error;
  let added = 0;
  if (!classes.count) {
    const rows = schedule(clubId, branchIds);
    for (let i = 0; i < rows.length; i += 200) {
      const { error } = await db.from("class_sessions").insert(rows.slice(i, i + 200));
      if (error) throw error;
    }
    added = rows.length;
  }
  return { name: seed.name, clubId, branches: branchIds.length, classesAdded: added, classesKept: classes.count ?? 0 };
}

async function main() {
  console.log(`Seeding development data into project ${ref} (Malaysia date ${today}).`);
  console.log(`Owner account: ${await ensureOwner()} (${email}).`);
  const signedIn = await db.auth.signInWithPassword({ email, password });
  if (signedIn.error) throw signedIn.error;
  for (const club of CLUBS) {
    const result = await seedClub(club, signedIn.data.user.id);
    console.log(`- ${result.name}: ${result.branches} branches, ${result.classesAdded ? `${result.classesAdded} classes added` : `${result.classesKept} existing classes kept`} (/clubs/${result.clubId}/classes)`);
  }
  await db.auth.signOut();
  console.log("Done. Log in with DEV_SEED_OWNER_EMAIL / DEV_SEED_OWNER_PASSWORD from .env.local.");
}

main().catch((error: unknown) => {
  const { message, code } = (error ?? {}) as { message?: string; code?: string };
  console.error(`Seed failed${code ? ` (${code})` : ""}: ${message ?? String(error)}`);
  process.exit(1);
});
