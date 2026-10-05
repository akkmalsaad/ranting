// Calendar helpers on plain YYYY-MM-DD strings (computed in UTC), so no local timezone shifts a date.
export const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
export const WEEKDAYS_MONDAY_FIRST = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

const pad = (n: number) => String(n).padStart(2, "0");
/** month is 1–12. */
export const ymd = (year: number, month: number, day: number) => `${year}-${pad(month)}-${pad(day)}`;
export const daysInMonth = (year: number, month: number) => new Date(Date.UTC(year, month, 0)).getUTCDate();
/** 0 = Monday … 6 = Sunday. */
export const mondayIndex = (year: number, month: number, day: number) => (new Date(Date.UTC(year, month - 1, day)).getUTCDay() + 6) % 7;
export const shiftDays = (date: string, days: number) => {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};
/** "2015-06-05" → "05/06/2015" (DD/MM/YYYY). */
export const toDDMMYYYY = (date: string) => `${date.slice(8, 10)}/${date.slice(5, 7)}/${date.slice(0, 4)}`;
export const longDate = (date: string) => new Intl.DateTimeFormat("en-MY", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${date}T00:00:00Z`));
