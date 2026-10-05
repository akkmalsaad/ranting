// Display-only helpers for the Fees list and details panel: relative due status, short dates and
// billing period labels. Nothing here changes amounts or statuses; those come from fee_list /
// loadFee. Dates are Malaysia calendar dates as plain YYYY-MM-DD strings (no time zone maths).

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export type FeeDisplayStatus = "unpaid" | "partial" | "paid" | "voided";
export type DueTone = "danger" | "warning" | "neutral" | "success" | "muted";
export type DueState = { kind: "voided" | "paid" | "late" | "today" | "partial" | "upcoming"; label: string; tone: DueTone; days: number };

/** Whole days from `from` to `to` (both YYYY-MM-DD); negative when `to` is earlier. */
export function daysBetween(from: string, to: string) {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

/**
 * The status pill: "4 days late", "Due today", "Partly paid", "Due in 3 days", "Paid", "Voided".
 * Order: voided, paid, late (balance after the due date, as fee_list's `overdue`), due today,
 * partly paid, upcoming. `today` is the Malaysia date (todayInMalaysia on the server).
 */
export function dueState(fee: { status: FeeDisplayStatus | string; balance_sen: number; due_date: string }, today: string): DueState {
  const days = daysBetween(today, fee.due_date);
  if (fee.status === "voided") return { kind: "voided", label: "Voided", tone: "muted", days };
  if (fee.status === "paid" || fee.balance_sen <= 0) return { kind: "paid", label: "Paid", tone: "success", days };
  if (days < 0) return { kind: "late", label: `${-days} ${days === -1 ? "day" : "days"} late`, tone: "danger", days };
  if (days === 0) return { kind: "today", label: "Due today", tone: "warning", days };
  if (fee.status === "partial") return { kind: "partial", label: "Partly paid", tone: "warning", days };
  return { kind: "upcoming", label: `Due in ${days} ${days === 1 ? "day" : "days"}`, tone: "neutral", days };
}

/** "1 Oct", with the year when it isn't the current one ("1 Oct 2025"). */
export function shortDueDate(date: string, today: string) {
  const label = `${Number(date.slice(8, 10))} ${MONTHS[Number(date.slice(5, 7)) - 1]}`;
  return date.slice(0, 4) === today.slice(0, 4) ? label : `${label} ${date.slice(0, 4)}`;
}

/** Billing period: "Oct 2026", or just "2026" for yearly fees. `billingMonth` is YYYY-MM[-DD]. */
export function billingPeriodLabel(feeType: string, billingMonth: string) {
  return feeType === "yearly" ? billingMonth.slice(0, 4) : `${MONTHS[Number(billingMonth.slice(5, 7)) - 1]} ${billingMonth.slice(0, 4)}`;
}

/** Paid share for the progress bar, 0–100, from integer sen (no floating-point money maths). */
export function paidPercent(paidSen: number, amountSen: number) {
  if (amountSen <= 0) return 0;
  return Math.min(100, Math.max(0, Math.floor((paidSen * 100) / amountSen)));
}
