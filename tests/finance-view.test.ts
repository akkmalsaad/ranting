import { test } from "node:test";
import assert from "node:assert/strict";
import { financeHref, formatRange, listFilters, monthsOf, periodChanges, resolvePeriod } from "../src/lib/finance/view.ts";

const TODAY = "2026-10-01";

test("default and presets resolve to inclusive Malaysia calendar ranges with an exclusive SQL end", () => {
  assert.deepEqual(pick(resolvePeriod({}, TODAY)), { kind: "this-month", start: "2026-10-01", last: "2026-10-31", end: "2026-11-01", params: {} });
  assert.deepEqual(pick(resolvePeriod({ period: "last-month" }, TODAY)), { kind: "last-month", start: "2026-09-01", last: "2026-09-30", end: "2026-10-01", params: { period: "last-month" } });
  assert.deepEqual(pick(resolvePeriod({ period: "ytd" }, TODAY)), { kind: "ytd", start: "2026-01-01", last: "2026-10-01", end: "2026-10-02", params: { period: "ytd" } });
  // January: last month is December of the previous year.
  assert.equal(resolvePeriod({ period: "last-month" }, "2027-01-15")?.start, "2026-12-01");
});

test("month, day and custom range (legacy ?month= and ?date= links keep working)", () => {
  assert.deepEqual(pick(resolvePeriod({ month: "2024-02" }, TODAY)), { kind: "month", start: "2024-02-01", last: "2024-02-29", end: "2024-03-01", params: { month: "2024-02" } });
  assert.deepEqual(pick(resolvePeriod({ date: "2024-12-31" }, TODAY)), { kind: "day", start: "2024-12-31", last: "2024-12-31", end: "2025-01-01", params: { date: "2024-12-31" } });
  assert.equal(resolvePeriod({ date: "2024-12-31", month: "2024-01" }, TODAY)?.kind, "day");
  assert.deepEqual(pick(resolvePeriod({ from: "2026-03-05", to: "2026-03-05" }, TODAY)), { kind: "range", start: "2026-03-05", last: "2026-03-05", end: "2026-03-06", params: { from: "2026-03-05", to: "2026-03-05" } });
});

test("invalid period parameters are rejected", () => {
  for (const input of [{ period: "forever" }, { from: "2026-03-05" }, { from: "2026-03-06", to: "2026-03-05" }, { from: "2026-02-30", to: "2026-03-01" }, { date: "2026-13-01" }, { month: "2026-1" }, { period: ["ytd", "ytd"] }]) {
    assert.equal(resolvePeriod(input, TODAY), null, JSON.stringify(input));
  }
});

test("ranges read naturally and YTD months run January to the current month", () => {
  assert.equal(formatRange("2026-10-01", "2026-10-31"), "1–31 Oct 2026");
  assert.equal(formatRange("2026-01-01", "2026-10-01"), "1 Jan – 1 Oct 2026");
  assert.equal(formatRange("2025-12-15", "2026-01-03"), "15 Dec 2025 – 3 Jan 2026");
  assert.equal(formatRange("2026-10-01", "2026-10-01"), "1 Oct 2026");
  assert.deepEqual(monthsOf({ start: "2026-01-01", last: "2026-03-01" }), ["2026-01", "2026-02", "2026-03"]);
});

test("list filters: tabs, kind-scoped categories, legacy links and search", () => {
  assert.deepEqual(listFilters({}), { tab: "", kind: "", category: "", categoryKind: "", categoryParam: "", search: "" });
  assert.equal(listFilters({ kind: "invoice" }), null);
  // Under All, a category implies its kind; "events" exists for both kinds.
  assert.deepEqual(listFilters({ category: "expense:events" }), { tab: "", kind: "expense", category: "events", categoryKind: "expense", categoryParam: "expense:events", search: "" });
  assert.equal(listFilters({ category: "income:uncategorised" })?.category, "uncategorised");
  // Incompatible or unknown categories are dropped.
  assert.equal(listFilters({ kind: "expense", category: "income:monthly_fees" })?.category, "");
  assert.equal(listFilters({ category: "income:rent" })?.category, "");
  // Legacy: ?kind=income&category=monthly_fees.
  assert.equal(listFilters({ kind: "income", category: "monthly_fees" })?.categoryParam, "income:monthly_fees");
  assert.equal(listFilters({ q: "  hall (rent)  " })?.search, "hall rent");
});

test("links replace every period key and drop empty values", () => {
  const query = { month: "2024-02", branch: "b", kind: "income", page: "3" };
  assert.equal(financeHref("/f", query, periodChanges({ period: "ytd" })), "/f?branch=b&kind=income&period=ytd");
  assert.equal(financeHref("/f", {}, periodChanges({})), "/f");
});

function pick(p: ReturnType<typeof resolvePeriod>) {
  return p && { kind: p.kind, start: p.start, last: p.last, end: p.end, params: p.params };
}
