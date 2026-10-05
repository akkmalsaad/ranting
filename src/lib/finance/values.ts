import { z } from "zod";
import { todayInMalaysia } from "../validation.ts";

/** MYR input is parsed as decimal digits, never multiplied as a floating-point amount. */
export const amountSchema = z.string().trim().regex(/^\d{1,8}(\.\d{1,2})?$/, "Enter a positive MYR amount with at most two decimal places.")
  .transform((value) => { const [whole, fraction = ""] = value.split("."); return Number(whole) * 100 + Number(fraction.padEnd(2, "0")); })
  .refine((sen) => sen > 0 && sen <= 999999999, "Enter an amount from RM0.01 to RM9,999,999.99.");
/** Categories per record kind; values mirror the check constraints on payments_received / expenses. */
export const transactionCategories = {
  income: [
    { value: "monthly_fees", label: "Monthly fees" },
    { value: "registration_fees", label: "Registration fees" },
    { value: "grading_fees", label: "Grading / examination fees" },
    { value: "events", label: "Events / competitions" },
    { value: "merchandise", label: "Merchandise / uniforms" },
    { value: "donations", label: "Donations / sponsorships" },
    { value: "other_income", label: "Other income" },
  ],
  expense: [
    { value: "rent", label: "Rent / venue" },
    { value: "staff_payments", label: "Instructor / staff payments" },
    { value: "equipment", label: "Equipment" },
    { value: "utilities", label: "Utilities" },
    { value: "events", label: "Events / competitions" },
    { value: "marketing", label: "Marketing" },
    { value: "administration", label: "Administration" },
    { value: "other_expenses", label: "Other expenses" },
  ],
} as const;
export type TransactionKind = keyof typeof transactionCategories;
/** Filter value for historical records saved before categories existed. */
export const UNCATEGORISED = "uncategorised";

/** Club-defined categories use generated keys like "custom_ab12cd34ef56" (see transaction_categories). */
export const CUSTOM_CATEGORY = /^custom_[a-z0-9]{12}$/;
export type CategoryOption = { value: string; label: string; archived: boolean; custom: boolean };
/** A club's effective categories: built-ins (possibly renamed or archived) followed by its own. */
export type ClubCategories = Record<TransactionKind, CategoryOption[]>;
export const builtinCategories: ClubCategories = {
  income: transactionCategories.income.map((c) => ({ value: c.value, label: c.label, archived: false, custom: false })),
  expense: transactionCategories.expense.map((c) => ({ value: c.value, label: c.label, archived: false, custom: false })),
};
const isKnownKey = (kind: TransactionKind, value: unknown) => typeof value === "string" && (CUSTOM_CATEGORY.test(value) || transactionCategories[kind].some((c) => c.value === value));

/** Display label; pass the club's categories so renamed and custom ones show their own names. */
export function categoryLabel(kind: TransactionKind, value: string | null, categories: ClubCategories = builtinCategories) {
  if (!value) return "Uncategorised";
  return categories[kind].find((c) => c.value === value)?.label ?? (CUSTOM_CATEGORY.test(value) ? "Custom category" : "Uncategorised");
}

/** A valid category filter for this kind (a category or "uncategorised"), else "" (all). */
export function categoryFilter(kind: TransactionKind, value: unknown) {
  if (value === UNCATEGORISED) return UNCATEGORISED;
  return isKnownKey(kind, value) ? (value as string) : "";
}

export const transactionSchema = z.object({
  request_id: z.uuid(),
  kind: z.enum(["income", "expense"]),
  amount: amountSchema,
  occurred_on: z.iso.date().refine((date) => date >= "1900-01-01" && date <= todayInMalaysia(), "Use a date from 1900 through today in Malaysia."),
  description: z.string().trim().min(2, "Describe this transaction.").max(200, "Use at most 200 characters."),
  branch_id: z.union([z.literal(""), z.uuid()]).transform((value) => value || null),
  category: z.string({ error: "Choose a category." }).min(1, "Choose a category."),
}).superRefine((t, ctx) => {
  // Shape only; the database checks a custom category belongs to the club and isn't archived.
  if (t.category && !isKnownKey(t.kind, t.category)) {
    ctx.addIssue({ code: "custom", path: ["category"], message: "Choose a category." });
  }
});

export function monthPeriod(value: string) {
  const start = `${value}-01`;
  const next = new Date(`${start}T00:00:00Z`);
  next.setUTCMonth(next.getUTCMonth() + 1);
  return { start, end: next.toISOString().slice(0, 10), label: new Intl.DateTimeFormat("en-MY", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${start}T00:00:00Z`)) };
}

/** A single Malaysia calendar day [date, date + 1), with the same shape as monthPeriod. */
export function dayPeriod(value: string) {
  const day = new Date(`${value}T00:00:00Z`);
  const next = new Date(day);
  next.setUTCDate(next.getUTCDate() + 1);
  return { start: value, end: next.toISOString().slice(0, 10), label: new Intl.DateTimeFormat("en-MY", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(day) };
}
export const daySchema = z.iso.date().refine((date) => date >= "1900-01-01" && date <= "2199-12-31");

export function malaysiaMonth(now = new Date()) { return monthPeriod(todayInMalaysia(now).slice(0, 7)); }
export const monthSchema = z.string().regex(/^(19|20|21)\d{2}-(0[1-9]|1[0-2])$/);

/** Totals come from SQL as text so even large sums never lose integer precision. */
export function formatMYR(sen: string | number) {
  const value = BigInt(sen);
  const whole = (value / BigInt(100)).toLocaleString("en-MY");
  return `RM${whole}.${(value % BigInt(100)).toString().padStart(2, "0")}`;
}

/** Signed MYR for net cash flow (income − expenses), from integer-sen totals: "RM12.50" / "−RM3.00". */
export function formatSignedMYR(sen: bigint) {
  return sen < BigInt(0) ? `−${formatMYR((-sen).toString())}` : formatMYR(sen.toString());
}
