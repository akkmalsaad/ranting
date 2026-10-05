// Finance page view state from the URL: the reporting period, the transaction-list filters and
// link building. Pure functions on plain YYYY-MM-DD strings (UTC arithmetic), so no local timezone
// shifts a date; shared by the server page and the client controls.
import { MONTH_NAMES, daysInMonth, shiftDays, ymd } from "../calendar.ts";
import { searchTerm } from "../validation.ts";
import { categoryFilter, daySchema, monthSchema, type TransactionKind } from "./values.ts";

export type PeriodKind = "this-month" | "last-month" | "ytd" | "month" | "day" | "range";

/**
 * A reporting period. `start`/`last` are inclusive calendar dates; `end` is the day after `last`
 * (the half-open [start, end) contract of the finance SQL functions). `params` are the URL
 * parameters that select it ({} = the default, this month).
 */
export type FinancePeriod = { kind: PeriodKind; start: string; last: string; end: string; name: string; range: string; params: Record<string, string> };

/** Every URL key that selects a period; a new period replaces all of them. */
export const PERIOD_KEYS = ["period", "month", "date", "from", "to"] as const;

const shortMonth = (date: string) => MONTH_NAMES[Number(date.slice(5, 7)) - 1].slice(0, 3);
const day = (date: string) => Number(date.slice(8, 10));

/** "12 Oct 2026", "1–31 Oct 2026", "1 Jan – 1 Oct 2026", "15 Dec 2025 – 3 Jan 2026". */
export function formatRange(start: string, last: string) {
  const [y1, y2] = [start.slice(0, 4), last.slice(0, 4)];
  if (start === last) return `${day(start)} ${shortMonth(start)} ${y1}`;
  if (start.slice(0, 7) === last.slice(0, 7)) return `${day(start)}–${day(last)} ${shortMonth(last)} ${y2}`;
  if (y1 === y2) return `${day(start)} ${shortMonth(start)} – ${day(last)} ${shortMonth(last)} ${y2}`;
  return `${day(start)} ${shortMonth(start)} ${y1} – ${day(last)} ${shortMonth(last)} ${y2}`;
}

/** "YYYY-MM" shifted by whole months. */
export function shiftMonth(month: string, step: number) {
  const index = Number(month.slice(0, 4)) * 12 + Number(month.slice(5, 7)) - 1 + step;
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, "0")}`;
}

export const monthName = (month: string) => `${MONTH_NAMES[Number(month.slice(5, 7)) - 1]} ${month.slice(0, 4)}`;

function build(kind: PeriodKind, start: string, last: string, name: string, params: Record<string, string>): FinancePeriod {
  return { kind, start, last, end: shiftDays(last, 1), name, range: formatRange(start, last), params };
}
function wholeMonth(kind: PeriodKind, month: string, name: string, params: Record<string, string>) {
  const [y, m] = [Number(month.slice(0, 4)), Number(month.slice(5, 7))];
  return build(kind, `${month}-01`, ymd(y, m, daysInMonth(y, m)), name, params);
}

const one = (value: unknown) => (typeof value === "string" ? value : undefined);

/**
 * The period selected by the URL, or null when its parameters are invalid (the page 404s, as for
 * any malformed filter). Precedence: `period` preset, then `from`+`to` (custom range, inclusive),
 * then `date` (single day), then `month`; otherwise this month. Existing `?month=` and `?date=`
 * links keep working. `today` is the Malaysia calendar date.
 */
export function resolvePeriod(input: Record<string, unknown>, today: string): FinancePeriod | null {
  const thisMonth = today.slice(0, 7);
  const [preset, from, to, date, month] = [one(input.period), one(input.from), one(input.to), one(input.date), one(input.month)];
  if (input.period !== undefined) {
    if (preset === "this-month") return wholeMonth("this-month", thisMonth, "This month", {});
    if (preset === "last-month") return wholeMonth("last-month", shiftMonth(thisMonth, -1), "Last month", { period: "last-month" });
    if (preset === "ytd") return build("ytd", `${today.slice(0, 4)}-01-01`, today, "Year to date", { period: "ytd" });
    return null;
  }
  if (input.from !== undefined || input.to !== undefined) {
    if (!from || !to || !daySchema.safeParse(from).success || !daySchema.safeParse(to).success || to < from) return null;
    return build("range", from, to, "Custom range", { from, to });
  }
  if (input.date !== undefined) return date && daySchema.safeParse(date).success ? build("day", date, date, formatRange(date, date), { date }) : null;
  if (input.month !== undefined) return month && monthSchema.safeParse(month).success ? wholeMonth("month", month, monthName(month), { month }) : null;
  return wholeMonth("this-month", thisMonth, "This month", {});
}

/** Calendar months ("YYYY-MM") from the period's first to its last month, inclusive. */
export function monthsOf(period: Pick<FinancePeriod, "start" | "last">) {
  const months: string[] = [];
  for (let m = period.start.slice(0, 7); m <= period.last.slice(0, 7); m = shiftMonth(m, 1)) months.push(m);
  return months;
}

/**
 * Transaction-list filters (they never change the overview): the All / Income / Expenses tab
 * (`kind`), a category (`category=<kind>:<value>`, `<kind>:uncategorised` for older records) and a
 * description search (`q`). A category must match the tab, so an incompatible one is dropped.
 * Legacy links (`?kind=income&category=monthly_fees`) are read as that kind's category.
 * Returns null for an unknown tab.
 */
export function listFilters(input: Record<string, unknown>) {
  const kindParam = one(input.kind);
  if (input.kind !== undefined && kindParam !== "all" && kindParam !== "income" && kindParam !== "expense") return null;
  const tab: "" | TransactionKind = kindParam === "income" || kindParam === "expense" ? kindParam : "";
  let category = "", categoryKind: "" | TransactionKind = "";
  const raw = one(input.category);
  if (raw) {
    const [k, v] = raw.includes(":") ? [raw.slice(0, raw.indexOf(":")), raw.slice(raw.indexOf(":") + 1)] : [tab, raw];
    if ((k === "income" || k === "expense") && (!tab || tab === k) && categoryFilter(k, v)) { category = categoryFilter(k, v); categoryKind = k; }
  }
  return {
    tab,
    /** Kind passed to the query: the tab, or the category's kind under All. */
    kind: tab || categoryKind,
    /** Category for the query ("" = all, "uncategorised", or a value of `categoryKind`). */
    category,
    categoryKind,
    /** Canonical URL value of the category filter. */
    categoryParam: category ? `${categoryKind}:${category}` : "",
    search: searchTerm(input.q),
  };
}
export type ListFilters = NonNullable<ReturnType<typeof listFilters>>;

/** A Finance link: the current canonical params with `changes` applied (empty/undefined removes a key). */
export function financeHref(base: string, query: Record<string, string>, changes: Record<string, string | undefined> = {}) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries({ ...query, ...changes })) if (value) params.set(key, value);
  const qs = params.toString();
  return qs ? `${base}?${qs}` : base;
}

/** Changes that switch to another period (clearing every other period key and the page). */
export function periodChanges(params: Record<string, string>) {
  return { ...Object.fromEntries(PERIOD_KEYS.map((k) => [k, undefined])), ...params, page: undefined };
}
