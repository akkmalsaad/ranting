import { BRANCH_TONES, resolveBranchColors, type BranchTone } from "./branch-colors.ts";
import { daysInMonth, mondayIndex, shiftDays, ymd } from "./calendar.ts";

export type { BranchTone };

// Shared by the Classes page (server) and its client components. Dates and times are Malaysia
// wall-clock values stored as plain strings, so nothing here converts between time zones.

export type ClassSession = {
  id: string;
  name: string;
  branch_id: string;
  session_date: string; // YYYY-MM-DD (Asia/Kuala_Lumpur)
  start_time: string; // HH:MM[:SS] (Asia/Kuala_Lumpur)
  end_time: string;
  instructor_name: string | null;
  notes: string | null;
  status: "scheduled" | "completed" | "cancelled" | string;
  /** Set when the class was created as part of a weekly series (each session is still edited on its own). */
  series_id: string | null;
  series: { weekdays: number[]; start_date: string; end_date: string } | null;
};
export type ClassBranch = {
  id: string;
  name: string;
  archived_at: string | null;
  /** 2–4 uppercase characters, unique per club; shown on calendar chips. Null if none (or not migrated yet). */
  short_code: string | null;
  /** Saved palette key (lib/branch-colors.ts); null falls back to the id-order colour. */
  color: string | null;
};

export const CLASS_STATUS_LABELS: Record<string, string> = { scheduled: "Scheduled", completed: "Completed", cancelled: "Cancelled" };

/** "18:30:00" → "6:30 PM". */
export function formatClassTime(time: string) {
  const [h, m] = time.split(":").map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}
export const formatClassRange = (s: Pick<ClassSession, "start_time" | "end_time">) => `${formatClassTime(s.start_time)} – ${formatClassTime(s.end_time)}`;
/** "18:00:00" → "6", "18:30:00" → "6:30" (12-hour clock, no AM/PM). */
function compactClock(time: string) {
  const [h, m] = time.split(":").map(Number);
  return m ? `${h % 12 || 12}:${String(m).padStart(2, "0")}` : `${h % 12 || 12}`;
}
const period = (time: string) => (Number(time.split(":")[0]) < 12 ? "AM" : "PM");
/**
 * Compact range for calendar chips: whole hours drop ":00" and AM/PM appears once when both times
 * are in the same half of the day: "9–11 AM", "9:30–11 AM", "11 AM–1 PM".
 */
export function formatClassRangeShort(s: Pick<ClassSession, "start_time" | "end_time">) {
  const [start, end] = [compactClock(s.start_time), compactClock(s.end_time)];
  const [startPeriod, endPeriod] = [period(s.start_time), period(s.end_time)];
  return startPeriod === endPeriod ? `${start}–${end} ${endPeriod}` : `${start} ${startPeriod}–${end} ${endPeriod}`;
}

const malaysiaClock = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kuala_Lumpur", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
/** Malaysia wall-clock time now, "HH:MM" (24-hour), comparable with `end_time.slice(0, 5)`. */
export const malaysiaTimeNow = (now = new Date()) => malaysiaClock.format(now);

/** Monday-first weeks covering the month, including leading/trailing days of adjacent months. */
export function monthGrid(month: string) {
  const year = Number(month.slice(0, 4));
  const mon = Number(month.slice(5, 7));
  const first = ymd(year, mon, 1);
  const start = shiftDays(first, -mondayIndex(year, mon, 1));
  const last = ymd(year, mon, daysInMonth(year, mon));
  const end = shiftDays(last, 6 - mondayIndex(year, mon, daysInMonth(year, mon)));
  const weeks: string[][] = [];
  for (let day = start; day <= end; day = shiftDays(day, 7)) weeks.push(Array.from({ length: 7 }, (_, i) => shiftDays(day, i)));
  return { start, end, weeks, first, last };
}

export const shiftMonth = (month: string, step: number) => {
  const index = Number(month.slice(0, 4)) * 12 + Number(month.slice(5, 7)) - 1 + step;
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, "0")}`;
};

// Branch colours: each branch's saved palette colour, or (none saved) the fallback by branch-id
// order (see lib/branch-colors.ts). Always shown alongside the branch name (never colour alone).
export function branchColors(branches: Pick<ClassBranch, "id" | "color">[]) {
  return new Map([...resolveBranchColors(branches)].map(([id, key]) => [id, BRANCH_TONES[key]]));
}
/** A branch's tone from `branchColors`, with a stable fallback for an id missing from the map. */
export const getBranchColor = (colors: Map<string, BranchTone>, branchId: string) => colors.get(branchId) ?? BRANCH_TONES.teal;

/** Classes page URL with month/date/branch/page (empty values dropped). */
export function classesHref(base: string, params: { month?: string; date?: string; branch?: string; page?: number }) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) if (value !== undefined && value !== "" && !(key === "page" && value === 1)) search.set(key, String(value));
  const qs = search.toString();
  return qs ? `${base}?${qs}` : base;
}
