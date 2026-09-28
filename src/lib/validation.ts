import { z } from "zod";

// Domain validation shared by client forms and Server Actions. The server result is authoritative;
// database constraints in supabase/migrations mirror these limits.
export const MALAYSIA_TIME_ZONE = "Asia/Kuala_Lumpur";

/** Today's calendar date in Malaysia as YYYY-MM-DD, independent of the server's time zone. */
export function todayInMalaysia(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: MALAYSIA_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

export const idSchema = z.uuid();

const required = { error: "This field is required." };
const text = (min: number, max: number) => z.string(required).trim().min(min, `Use at least ${min} characters.`).max(max, `Use at most ${max} characters.`);
const name = text(2, 120);
const blank = (value: unknown) => (typeof value === "string" ? value.trim() : (value ?? ""));
/** Empty input becomes null; anything else must satisfy `schema`. */
const optional = <T extends z.ZodType>(schema: T) => z.preprocess(blank, z.union([z.literal("").transform(() => null), schema]));

const isoDate = z.string(required).trim().regex(/^\d{4}-\d{2}-\d{2}$/, "Enter a valid date.").refine((value) => {
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value) && value > "1900-01-01";
}, "Enter a valid date.");

/** Accepts common Malaysian formats (012-345 6789, +60 12-345 6789) and stores digits with an optional leading +. */
export const phoneSchema = z.string().transform((value) => value.replace(/[\s\-().]/g, "")).pipe(z.string().regex(/^\+?\d{9,15}$/, "Enter a valid phone number, e.g. 012-345 6789."));

export const clubSchema = z.object({ name, discipline: text(2, 80) });

export const branchSchema = z.object({ name, address: z.preprocess(blank, z.string().max(500, "Use at most 500 characters.")) });

export const studentStatuses = ["active", "inactive"] as const;
export const studentGenders = ["male", "female"] as const;

export const studentSchema = z.object({
  full_name: name,
  date_of_birth: optional(isoDate.refine((value) => value <= todayInMalaysia(), "Date of birth cannot be in the future.")),
  gender: optional(z.enum(studentGenders, "Choose male or female.")),
  phone: optional(phoneSchema),
  guardian_name: optional(text(2, 120)),
  guardian_phone: optional(phoneSchema),
  branch_id: optional(idSchema),
  status: z.enum(studentStatuses, "Choose active or inactive."),
  join_date: isoDate,
  notes: optional(z.string().max(2000, "Use at most 2000 characters.")),
}).refine((s) => !s.date_of_birth || s.date_of_birth <= s.join_date, { path: ["date_of_birth"], message: "Date of birth must be on or before the join date." });

export type StudentInput = z.output<typeof studentSchema>;

// --- Accounts -------------------------------------------------------------------------------
// Supabase Auth rejects passwords over 72 characters; keep the dashboard minimum length at 8 or less.
export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 72;

const email = z.string(required).trim().toLowerCase().max(254, "Use at most 254 characters.").pipe(z.email("Enter a valid email address."));
export const passwordSchema = z.string(required)
  .min(PASSWORD_MIN, `Use at least ${PASSWORD_MIN} characters.`)
  .max(PASSWORD_MAX, `Use at most ${PASSWORD_MAX} characters.`)
  .regex(/[A-Za-z]/, "Include at least one letter.")
  .regex(/\d/, "Include at least one number.");
const confirmed = <T extends { password: string; confirm_password: string }>(value: T) => value.password === value.confirm_password;
const mismatch = { path: ["confirm_password"], message: "Passwords do not match." };

export const signInSchema = z.object({ email, password: z.string(required).min(1, "Enter your password.").max(PASSWORD_MAX, `Use at most ${PASSWORD_MAX} characters.`) });
export const signUpSchema = z.object({ full_name: name, email, password: passwordSchema, confirm_password: z.string(required) }).refine(confirmed, mismatch);
export const passwordResetRequestSchema = z.object({ email });
export const newPasswordSchema = z.object({ password: passwordSchema, confirm_password: z.string(required) }).refine(confirmed, mismatch);

/** Only same-site absolute paths are allowed as post-auth destinations (prevents open redirects). */
export function safeNextPath(value: unknown, fallback = "/workspaces") {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//") || value.includes("\\") || /[\u0000-\u001f]/.test(value)) return fallback;
  return value;
}

export function pageNumber(value: unknown) { const n = Number(value); return Number.isSafeInteger(n) && n > 0 ? Math.min(n, 100000) : 1; }
export function searchTerm(value: unknown) { return typeof value === "string" ? value.trim().replace(/[%_\\,()"]/g, "").slice(0, 80) : ""; }
