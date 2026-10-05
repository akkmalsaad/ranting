import { z } from "zod";
import { BRANCH_COLOR_KEYS, SHORT_CODE_PATTERN } from "./branch-colors.ts";

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

// --- Club profile (all optional) ------------------------------------------------------------
export const malaysianStates = [
  { value: "johor", label: "Johor" },
  { value: "kedah", label: "Kedah" },
  { value: "kelantan", label: "Kelantan" },
  { value: "melaka", label: "Melaka" },
  { value: "negeri-sembilan", label: "Negeri Sembilan" },
  { value: "pahang", label: "Pahang" },
  { value: "perak", label: "Perak" },
  { value: "perlis", label: "Perlis" },
  { value: "pulau-pinang", label: "Pulau Pinang" },
  { value: "sabah", label: "Sabah" },
  { value: "sarawak", label: "Sarawak" },
  { value: "selangor", label: "Selangor" },
  { value: "terengganu", label: "Terengganu" },
  { value: "kuala-lumpur", label: "W.P. Kuala Lumpur" },
  { value: "labuan", label: "W.P. Labuan" },
  { value: "putrajaya", label: "W.P. Putrajaya" },
] as const;
const stateValues = malaysianStates.map((s) => s.value) as [string, ...string[]];

/** Malaysian mobile/landline: 0… or +60… / 60…, stored as digits with an optional leading +. */
export const malaysianPhoneSchema = z.string().transform((value) => value.replace(/[\s\-().]/g, "")).pipe(z.string().regex(/^(\+?60|0)\d{8,10}$/, "Enter a Malaysian phone number, e.g. 03-1234 5678 or 012-345 6789."));
const registration = z.string().max(50, "Use at most 50 characters.").regex(/^[A-Za-z0-9][A-Za-z0-9 ()./-]*$/, "Use letters, numbers, spaces and - / . ( ) only.").min(2, "Use at least 2 characters.");
export const clubProfileSchema = z.object({
  ros_number: optional(registration),
  sports_commissioner_number: optional(registration),
  ssm_number: optional(registration),
  association: optional(text(2, 120)),
  address_line1: optional(z.string().max(200, "Use at most 200 characters.")),
  address_line2: optional(z.string().max(200, "Use at most 200 characters.")),
  postcode: optional(z.string().regex(/^\d{5}$/, "Postcodes have 5 digits.")),
  city: optional(text(2, 100)),
  state: optional(z.enum(stateValues, "Choose a state or federal territory.")),
  phone: optional(malaysianPhoneSchema),
  email: optional(z.string().toLowerCase().max(254, "Use at most 254 characters.").pipe(z.email("Enter a valid email address."))),
  year_founded: optional(z.string().regex(/^\d{4}$/, "Enter a 4-digit year.").transform(Number)
    .refine((year) => year >= 1900, "Enter a year from 1900.")
    .refine((year) => year <= Number(todayInMalaysia().slice(0, 4)), "The founding year can't be in the future.")),
});
export type ClubProfileInput = z.output<typeof clubProfileSchema>;
/** Settings page: the required club details plus the optional profile. */
export const clubSettingsSchema = z.object({ name, discipline: text(2, 80) }).extend(clubProfileSchema.shape);

// Branch details (all optional except the name). Coach details are contact text, not an account.
const emailSchema = z.string().toLowerCase().max(254, "Use at most 254 characters.").pipe(z.email("Enter a valid email address."));
export const branchSchema = z.object({
  name,
  // Calendar label and colour. Optional: only written when the form sends them (see branches/actions.ts).
  short_code: optional(z.string().toUpperCase().regex(SHORT_CODE_PATTERN, "Use 2–4 letters or numbers, e.g. BA.")),
  color: optional(z.enum(BRANCH_COLOR_KEYS, "Choose one of the colours.")),
  address_line1: optional(z.string().max(200, "Use at most 200 characters.")),
  address_line2: optional(z.string().max(200, "Use at most 200 characters.")),
  postcode: optional(z.string().regex(/^[A-Za-z0-9 -]{3,10}$/, "Enter a valid postcode, e.g. 68000.")),
  city: optional(text(2, 100)),
  state: optional(z.enum(stateValues, "Choose a state or federal territory.")),
  coach_name: optional(text(2, 120)),
  coach_phone: optional(phoneSchema),
  coach_role: optional(text(2, 80)),
  coach_email: optional(emailSchema),
});
export type BranchInput = z.output<typeof branchSchema>;

/** One-line display address stored in `branches.address` (shown on branch cards). */
export function formatBranchAddress(branch: Pick<BranchInput, "address_line1" | "address_line2" | "postcode" | "city" | "state">) {
  const state = malaysianStates.find((s) => s.value === branch.state)?.label ?? branch.state;
  const locality = [branch.postcode, branch.city].filter(Boolean).join(" ");
  return [branch.address_line1, branch.address_line2, locality, state].filter(Boolean).join(", ").slice(0, 500);
}

export const studentStatuses = ["active", "inactive"] as const;
export const studentGenders = ["male", "female"] as const;

/** Field rules for one student record; shared by the single-student and multi-child forms. */
const studentFields = {
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
  belt_level_id: optional(idSchema),
};
const DOB_AFTER_JOIN = "Date of birth must be on or before the join date.";

export const studentSchema = z.object(studentFields).refine((s) => !s.date_of_birth || s.date_of_birth <= s.join_date, { path: ["date_of_birth"], message: DOB_AFTER_JOIN });

export type StudentInput = z.output<typeof studentSchema>;

// --- Several children in one submission (Add student modal) ---------------------------------
// Each child is its own student record. Child-specific fields are submitted as
// `child_<key>_<field>`; guardian contact and membership are submitted once and apply to all.
export const CHILD_FIELDS = ["full_name", "date_of_birth", "gender", "phone"] as const;
export type ChildField = (typeof CHILD_FIELDS)[number];
/** Staff forms also set each child's belt level; public registration (CHILD_FIELDS only) never can. */
const STAFF_CHILD_FIELDS = [...CHILD_FIELDS, "belt_level_id"] as const;
export type StaffChildField = (typeof STAFF_CHILD_FIELDS)[number];
const SHARED_FIELDS = ["guardian_name", "guardian_phone", "branch_id", "status", "join_date", "notes"] as const;
export const MAX_CHILDREN = 50;
export const childFieldName = (key: string, field: StaffChildField) => `child_${key}_${field}`;

/** The hidden `child_keys` field: comma-separated, unique child keys in display order. */
export const childKeysSchema = z.string().regex(/^\d{1,6}(,\d{1,6})*$/).transform((value) => value.split(","))
  .refine((keys) => keys.length <= MAX_CHILDREN && new Set(keys).size === keys.length);

/** Validates every child with the single-student rules and returns one StudentInput per child, in order. */
export function studentBatchSchema(keys: string[]) {
  const shape: Record<string, z.ZodType> = Object.fromEntries(SHARED_FIELDS.map((field) => [field, studentFields[field]]));
  for (const key of keys) for (const field of STAFF_CHILD_FIELDS) shape[childFieldName(key, field)] = studentFields[field];
  return z.object(shape)
    .superRefine((value, ctx) => {
      for (const key of keys) {
        const dob = value[childFieldName(key, "date_of_birth")] as string | null;
        if (dob && dob > (value.join_date as string)) ctx.addIssue({ code: "custom", path: [childFieldName(key, "date_of_birth")], message: DOB_AFTER_JOIN });
      }
    })
    .transform((value) => keys.map((key) => ({
      ...Object.fromEntries(SHARED_FIELDS.map((field) => [field, value[field]])),
      ...Object.fromEntries(STAFF_CHILD_FIELDS.map((field) => [field, value[childFieldName(key, field)]])),
    }) as StudentInput));
}

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

// --- Belt levels ------------------------------------------------------------------------------
export const BELT_PRESET_COLORS = [
  { value: "#ffffff", label: "White" }, { value: "#facc15", label: "Yellow" }, { value: "#f97316", label: "Orange" },
  { value: "#16a34a", label: "Green" }, { value: "#2563eb", label: "Blue" }, { value: "#7c3aed", label: "Purple" },
  { value: "#dc2626", label: "Red" }, { value: "#92400e", label: "Brown" }, { value: "#111827", label: "Black" },
] as const;
export const hexColorSchema = z.string(required).trim().regex(/^#[0-9a-fA-F]{6}$/, "Enter a colour like #1a2b3c.").transform((value) => value.toLowerCase());
/**
 * Belt level: name, base colour and an optional lengthwise stripe. The "Add stripe" toggle submits
 * `stripe=on`; when it's off the stripe is saved as null (removed), keeping the name and base colour.
 */
export const beltLevelSchema = z.object({
  name: text(1, 60),
  color: hexColorSchema,
  stripe: z.literal("on").optional(),
  stripe_color: optional(hexColorSchema),
}).superRefine((level, ctx) => {
  if (level.stripe === "on" && !level.stripe_color) ctx.addIssue({ code: "custom", path: ["stripe_color"], message: "Choose a stripe colour, or turn off the stripe." });
}).transform((level) => ({ name: level.name, color: level.color, stripe_color: level.stripe === "on" ? level.stripe_color : null }));

/** Plain-language belt colour for screen readers: a preset name, or the hex code. */
export function describeBeltColor(hex: string) {
  const preset = BELT_PRESET_COLORS.find((p) => p.value === hex.toLowerCase());
  return preset ? preset.label.toLowerCase() : `colour ${hex.toLowerCase()}`;
}
export function describeBelt(color: string, stripe?: string | null) {
  return `${describeBeltColor(color)} belt${stripe ? ` with a ${describeBeltColor(stripe)} stripe` : ""}`;
}

// --- Classes (Malaysia local date and times) -----------------------------------------------------
export const classStatuses = ["scheduled", "completed", "cancelled"] as const;
export type ClassStatus = (typeof classStatuses)[number];
const clockTime = z.string(required).trim().regex(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/, "Enter a time like 18:30.").transform((value) => value.slice(0, 5));
const isRealDate = (value: string) => {
  const date = new Date(`${value}T00:00:00Z`);
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value) && value > "1900-01-01" && value < "2200-01-01";
};
const classFields = {
  name,
  branch_id: z.string({ error: "Choose a branch." }).pipe(z.uuid("Choose a branch.")),
  session_date: z.string(required).trim().refine(isRealDate, "Enter a valid date."),
  start_time: clockTime,
  end_time: clockTime,
  instructor_name: optional(text(2, 120)),
  notes: optional(z.string().max(2000, "Use at most 2000 characters.")),
};
const endAfterStart = { path: ["end_time"], message: "End time must be later than the start time." };
/** One class session (Edit class, and Add class when it doesn't repeat). */
export const classSessionSchema = z.object(classFields).refine((c) => c.end_time > c.start_time, endAfterStart);
export type ClassSessionInput = z.output<typeof classSessionSchema>;

/** ISO weekdays (1 = Monday … 7 = Sunday), as stored on class_series.weekdays. */
export const CLASS_WEEKDAYS = [
  { value: 1, short: "Mon", long: "Monday" }, { value: 2, short: "Tue", long: "Tuesday" }, { value: 3, short: "Wed", long: "Wednesday" },
  { value: 4, short: "Thu", long: "Thursday" }, { value: 5, short: "Fri", long: "Friday" }, { value: 6, short: "Sat", long: "Saturday" },
  { value: 7, short: "Sun", long: "Sunday" },
] as const;
/** Longest weekly series (matches the database check: end_date <= start_date + 366). */
export const MAX_SERIES_DAYS = 366;
export const isoWeekday = (date: string) => ((new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7) + 1;
const daysBetween = (from: string, to: string) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
/** Dates from `start` to `until` (inclusive) that fall on the given ISO weekdays; same rule as create_class_series(). */
export function weeklyDates(start: string, until: string, weekdays: readonly number[]) {
  const dates: string[] = [];
  const day = new Date(`${start}T00:00:00Z`);
  for (let i = 0; i <= Math.min(daysBetween(start, until), MAX_SERIES_DAYS); i++) {
    const value = day.toISOString().slice(0, 10);
    if (weekdays.includes(((day.getUTCDay() + 6) % 7) + 1)) dates.push(value);
    day.setUTCDate(day.getUTCDate() + 1);
  }
  return dates;
}

// Each weekday is its own checkbox field (weekday_1 … weekday_7), since form values are single strings.
const dayFlag = z.string().optional();
/**
 * Add class: a single session, or (repeat = "weekly") a weekly series from `session_date` until
 * `repeat_until` on the chosen weekdays. Output `weekdays` is [] for a single class.
 */
export const classCreateSchema = z.object({
  ...classFields,
  repeat: z.enum(["none", "weekly"], { error: "Choose how often this class repeats." }).default("none"),
  repeat_until: z.string().trim().optional(),
  weekday_1: dayFlag, weekday_2: dayFlag, weekday_3: dayFlag, weekday_4: dayFlag, weekday_5: dayFlag, weekday_6: dayFlag, weekday_7: dayFlag,
}).superRefine((c, ctx) => {
  if (c.end_time <= c.start_time) ctx.addIssue({ code: "custom", ...endAfterStart });
  if (c.repeat !== "weekly") return;
  const weekdays = CLASS_WEEKDAYS.filter((d) => c[`weekday_${d.value}`]).map((d) => d.value);
  if (weekdays.length === 0) ctx.addIssue({ code: "custom", path: ["weekdays"], message: "Choose at least one day." });
  const until = c.repeat_until ?? "";
  if (!isRealDate(until)) return ctx.addIssue({ code: "custom", path: ["repeat_until"], message: "Enter the date of the last class." });
  if (until <= c.session_date) return ctx.addIssue({ code: "custom", path: ["repeat_until"], message: "Choose a date after the start date." });
  if (daysBetween(c.session_date, until) > MAX_SERIES_DAYS) return ctx.addIssue({ code: "custom", path: ["repeat_until"], message: "A weekly class can repeat for up to one year." });
  if (weekdays.length && weeklyDates(c.session_date, until, weekdays).length === 0) ctx.addIssue({ code: "custom", path: ["weekdays"], message: "None of the chosen days fall between these dates." });
}).transform(({ repeat, repeat_until, weekday_1, weekday_2, weekday_3, weekday_4, weekday_5, weekday_6, weekday_7, ...session }) => {
  const flags = [weekday_1, weekday_2, weekday_3, weekday_4, weekday_5, weekday_6, weekday_7];
  return repeat === "weekly"
    ? { ...session, repeat, repeat_until: repeat_until as string, weekdays: CLASS_WEEKDAYS.filter((d) => flags[d.value - 1]).map((d) => d.value) }
    : { ...session, repeat, repeat_until: null, weekdays: [] as number[] };
});
export type ClassCreateInput = z.output<typeof classCreateSchema>;

// --- Registration review ------------------------------------------------------------------
export const applicationStatuses = ["pending", "approved", "rejected"] as const;
export type ApplicationStatus = (typeof applicationStatuses)[number];
export const applicationApprovalSchema = z.object({ branch_id: optional(idSchema), belt_level_id: optional(idSchema) });
export const applicationRejectionSchema = z.object({ rejection_reason: optional(z.string().max(500, "Use at most 500 characters.")) });

// --- Public registration (parent registration link) -----------------------------------------
/** Registration link tokens: 64 lowercase hex characters (matches the database check). */
export const registrationTokenSchema = z.string().regex(/^[0-9a-f]{64}$/);
export const MAX_REGISTRATION_CHILDREN = 10;
/**
 * What a parent submits: guardian details once (name and phone required so the club can make
 * contact; notes optional) plus one or more children, each validated with the same rules as
 * Add student under `child_<key>_<field>` names. Branch and status are never submitted: the branch
 * comes from the validated link and every application starts pending.
 */
export function publicRegistrationBatchSchema(keys: string[]) {
  const shape: Record<string, z.ZodType> = { guardian_name: text(2, 120), guardian_phone: z.preprocess(blank, phoneSchema), notes: studentFields.notes };
  for (const key of keys) for (const field of CHILD_FIELDS) shape[childFieldName(key, field)] = studentFields[field];
  return z.object(shape).transform((value) => ({
    guardian_name: value.guardian_name as string,
    guardian_phone: value.guardian_phone as string,
    notes: value.notes as string | null,
    children: keys.map((key) => ({
      full_name: value[childFieldName(key, "full_name")] as string,
      date_of_birth: value[childFieldName(key, "date_of_birth")] as string | null,
      gender: value[childFieldName(key, "gender")] as string | null,
      phone: value[childFieldName(key, "phone")] as string | null,
    })),
  }));
}

export function pageNumber(value: unknown) { const n = Number(value); return Number.isSafeInteger(n) && n > 0 ? Math.min(n, 100000) : 1; }
export function searchTerm(value: unknown) { return typeof value === "string" ? value.trim().replace(/[%_\\,()"]/g, "").slice(0, 80) : ""; }
