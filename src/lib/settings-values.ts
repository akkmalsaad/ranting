import { z } from "zod";
import { amountSchema } from "./finance/values.ts";

// Settings forms (shared by Server Actions and client-side early validation).

const DAY_ERROR = "Enter a day from 1 to 31.";

/** Monthly fee defaults: both optional (blank clears the default). */
export const feeDefaultsSchema = z.object({
  amount: z.string().trim().pipe(z.union([z.literal(""), amountSchema])).transform((value) => (value === "" ? null : value)),
  due_day: z.string().trim().pipe(z.union([
    z.literal(""),
    z.string().regex(/^\d{1,2}$/, DAY_ERROR).transform(Number).refine((day) => day >= 1 && day <= 31, DAY_ERROR),
  ])).transform((value) => (value === "" ? null : value)),
});

export const categoryNameSchema = z.object({
  label: z.string().trim().min(1, "Enter a category name.").max(60, "Use at most 60 characters."),
});

/** "7" → "7th"; used for "Due on the 7th of each month". */
export function ordinal(day: number) {
  const tens = day % 100;
  const suffix = tens >= 11 && tens <= 13 ? "th" : ({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[day % 10] ?? "th";
  return `${day}${suffix}`;
}
