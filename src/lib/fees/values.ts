import { z } from "zod";
import { idSchema, searchTerm, todayInMalaysia } from "../validation.ts";
import { amountSchema, monthSchema } from "../finance/values.ts";

// Student fees: types, statuses, URL filters and form validation shared by the Fees page, its
// modals and Server Actions. Amounts are integer sen; dates are Malaysia calendar dates.

/** Fee types; values mirror the student_fees check constraint. */
export const FEE_TYPES = [
  { value: "monthly", label: "Monthly training fee" },
  { value: "yearly", label: "Yearly / annual fee" },
  { value: "registration", label: "Registration" },
  { value: "grading", label: "Grading / examination" },
  { value: "uniform", label: "Uniform / merchandise" },
  { value: "event", label: "Event / competition" },
  { value: "other", label: "Other" },
] as const;
export type FeeType = (typeof FEE_TYPES)[number]["value"];
/** Add fee creates one-off charges only; monthly fees come from Generate monthly fees. A yearly fee is one-off too (nothing recurs). */
export const ONE_OFF_FEE_TYPES = FEE_TYPES.filter((t) => t.value !== "monthly");
export const feeTypeLabel = (value: string) => FEE_TYPES.find((t) => t.value === value)?.label ?? "Other";

export const PAYMENT_METHODS = [
  { value: "cash", label: "Cash" },
  { value: "bank_transfer", label: "Bank transfer" },
  { value: "duitnow_qr", label: "DuitNow QR" },
  { value: "other", label: "Other" },
] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number]["value"];
/** Methods the database accepts before the club-settings migration (no DuitNow QR yet). */
export const LEGACY_PAYMENT_METHODS: PaymentMethod[] = ["cash", "bank_transfer", "other"];
export const methodLabel = (value: string | null) => PAYMENT_METHODS.find((m) => m.value === value)?.label ?? "—";

/** List status filters ("" = all current fees). Voided fees only appear under "voided". */
export const FEE_STATUS_FILTERS = [
  { value: "", label: "All" },
  { value: "unpaid", label: "Unpaid" },
  { value: "partial", label: "Partially paid" },
  { value: "paid", label: "Paid" },
  { value: "overdue", label: "Overdue" },
  { value: "voided", label: "Voided" },
] as const;
export type FeeStatusFilter = (typeof FEE_STATUS_FILTERS)[number]["value"];

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
/** "2026-10" → "October 2026"; "2026-10-01" also accepted. */
export const billingMonthLabel = (month: string) => `${MONTHS[Number(month.slice(5, 7)) - 1]} ${month.slice(0, 4)}`;
export const shortMonthLabel = (month: string) => `${MONTHS[Number(month.slice(5, 7)) - 1].slice(0, 3)} ${month.slice(0, 4)}`;
export function shiftMonth(month: string, step: number) {
  const index = Number(month.slice(0, 4)) * 12 + Number(month.slice(5, 7)) - 1 + step;
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, "0")}`;
}

/**
 * Fees page filters from the URL: billing `month` (YYYY-MM, default this Malaysia month) or
 * `scope=outstanding` (every billing month with a balance), `branch`, `status`, student `q` and
 * `page`. Returns null for an invalid month, branch or status (the page 404s).
 */
export function feeFilters(input: Record<string, unknown>, today = todayInMalaysia()) {
  const one = (v: unknown) => (typeof v === "string" ? v : undefined);
  const month = one(input.month);
  if (month !== undefined && !monthSchema.safeParse(month).success) return null;
  const branch = one(input.branch) ?? "";
  if (branch && !idSchema.safeParse(branch).success) return null;
  const status = one(input.status) ?? "";
  if (!FEE_STATUS_FILTERS.some((s) => s.value === status)) return null;
  const outstanding = input.scope === "outstanding";
  return {
    outstanding,
    month: outstanding ? "" : month ?? today.slice(0, 7),
    branch,
    status: status as FeeStatusFilter,
    search: searchTerm(input.q),
  };
}
export type FeeFilters = NonNullable<ReturnType<typeof feeFilters>>;

/** Canonical URL params for the filters (current month is the default, so it's omitted). */
export function feeQuery(f: FeeFilters, today = todayInMalaysia()): Record<string, string> {
  return {
    ...(f.outstanding ? { scope: "outstanding" } : f.month !== today.slice(0, 7) ? { month: f.month } : {}),
    ...(f.branch ? { branch: f.branch } : {}),
    ...(f.status ? { status: f.status } : {}),
    ...(f.search ? { q: f.search } : {}),
  };
}

export function feesHref(base: string, query: Record<string, string>, changes: Record<string, string | undefined> = {}) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries({ ...query, ...changes })) if (value) params.set(key, value);
  const qs = params.toString();
  return qs ? `${base}?${qs}` : base;
}

/** Rebuilds a list query string from untrusted input (e.g. a bound return path), keeping only valid filters. */
export function safeFeeQuery(raw: string) {
  const params = Object.fromEntries(new URLSearchParams(raw));
  const filters = feeFilters(params);
  if (!filters) return "";
  const query = feeQuery(filters);
  const page = Number(params.page);
  if (Number.isSafeInteger(page) && page > 1 && page <= 100000) query.page = String(page);
  return new URLSearchParams(query).toString();
}

// --- Forms ------------------------------------------------------------------------------------

const optionalText = (max: number) => z.string().trim().max(max, `Use at most ${max} characters.`).optional().transform((v) => v || null);
const calendarDate = z.iso.date("Enter a valid date.").refine((d) => d >= "1900-01-01" && d <= "2199-12-31", "Enter a valid date.");
const branchField = z.union([z.literal(""), z.uuid()]).transform((v) => v || null);
const feeType = z.enum(FEE_TYPES.map((t) => t.value) as [FeeType, ...FeeType[]], { error: "Choose a fee type." });

const feeFields = {
  branch_id: branchField,
  fee_type: feeType,
  title: z.string().trim().min(2, "Enter a fee title.").max(120, "Use at most 120 characters."),
  billing_month: z.string({ error: "Choose a billing month." }).refine((v) => monthSchema.safeParse(v).success, "Choose a billing month."),
  due_date: calendarDate,
  amount: amountSchema,
  notes: optionalText(1000),
};

/** Edit fee (unpaid): every fee field except the student. */
export const feeEditSchema = z.object(feeFields);

/** Edit fee with payments: only non-financial details. */
export const feeEditLockedSchema = z.object({
  title: feeFields.title,
  due_date: feeFields.due_date,
  notes: feeFields.notes,
});

export const feePaymentSchema = z.object({
  request_id: z.uuid(),
  amount: amountSchema,
  paid_on: z.iso.date("Enter the payment date.").refine((d) => d >= "1900-01-01" && d <= todayInMalaysia(), "Use a date from 1900 through today in Malaysia."),
  method: z.enum(["cash", "bank_transfer", "duitnow_qr", "other"], { error: "Choose a payment method." }),
  reference: optionalText(100),
  notes: optionalText(500),
});

export const feeLinkSchema = z.object({
  request_id: z.uuid(),
  receipt_id: z.uuid({ error: "Choose a receipt." }),
  amount: amountSchema,
});

export const reasonSchema = z.object({
  reason: z.string().trim().min(3, "Give a short reason (at least 3 characters).").max(500, "Use at most 500 characters."),
});

/** Generate monthly fees: the reviewed list sent from the preview (amounts already in sen). */
export const generateFeesSchema = z.object({
  month: monthSchema,
  due_date: calendarDate,
  title: z.string().trim().min(2).max(120),
  items: z.array(z.object({ student_id: z.uuid(), amount_sen: z.number().int().min(1).max(999999999) })).min(1, "Choose at least one student.").max(500, "Generate at most 500 fees at a time; choose a branch."),
});

/** Add fee (batch): one-off fee details plus the selected students and their amounts (sen). */
export const feeBatchSchema = z.object({
  batch_id: z.uuid(),
  fee_type: z.enum(ONE_OFF_FEE_TYPES.map((t) => t.value) as [FeeType, ...FeeType[]], { error: "Choose a fee type." }),
  title: z.string().trim().min(2, "Enter a fee title.").max(120, "Use at most 120 characters."),
  billing_month: monthSchema,
  due_date: calendarDate,
  notes: z.string().trim().max(1000, "Use at most 1000 characters.").transform((v) => v || null),
  items: z.array(z.object({ student_id: z.uuid(), amount_sen: z.number().int().min(1).max(999999999) }))
    .min(1, "Select at least one student.").max(500, "Select at most 500 students at a time.")
    .refine((items) => new Set(items.map((i) => i.student_id)).size === items.length, "Each student can be selected only once."),
});

export const previewFeesSchema = z.object({ month: monthSchema, branch_id: z.union([z.literal(""), z.uuid()]) });
/** WhatsApp fee reminder: one current branch (never "all branches") and one billing month. */
export const feeReminderSchema = z.object({ branch_id: z.uuid(), month: monthSchema });
