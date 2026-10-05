import { test } from "node:test";
import assert from "node:assert/strict";
import { billingPeriodLabel, daysBetween, dueState, paidPercent, shortDueDate } from "../src/lib/fees/display.ts";
import { showBranchDetail } from "../src/lib/branch-colors.ts";

const TODAY = "2026-10-05";
const fee = (status: string, balance_sen: number, due_date: string) => ({ status, balance_sen, due_date });
const label = (status: string, balance: number, due: string) => dueState(fee(status, balance, due), TODAY).label;

test("due status: late, today, partly paid, upcoming, paid, voided (Malaysia dates)", () => {
  assert.equal(label("unpaid", 2000, "2026-10-01"), "4 days late");
  assert.equal(label("unpaid", 2000, "2026-10-04"), "1 day late");
  assert.equal(label("partial", 500, "2026-09-30"), "5 days late"); // late beats partly paid
  assert.equal(label("unpaid", 2000, "2026-10-05"), "Due today");
  assert.equal(label("partial", 500, "2026-10-05"), "Due today");
  assert.equal(label("partial", 500, "2026-10-08"), "Partly paid");
  assert.equal(label("unpaid", 2000, "2026-10-06"), "Due in 1 day");
  assert.equal(label("unpaid", 2000, "2026-10-08"), "Due in 3 days");
  assert.equal(label("paid", 0, "2026-09-01"), "Paid");
  assert.equal(label("voided", 2000, "2026-09-01"), "Voided");
  // Across a month and a year boundary.
  assert.equal(daysBetween("2026-12-30", "2027-01-02"), 3);
  assert.equal(dueState(fee("unpaid", 100, "2026-12-31"), "2027-01-01").label, "1 day late");
});

test("short due dates, billing periods and the paid bar", () => {
  assert.equal(shortDueDate("2026-10-01", TODAY), "1 Oct");
  assert.equal(shortDueDate("2025-12-31", TODAY), "31 Dec 2025");
  assert.equal(billingPeriodLabel("monthly", "2026-10-01"), "Oct 2026");
  assert.equal(billingPeriodLabel("yearly", "2026-01-01"), "2026");
  assert.equal(billingPeriodLabel("registration", "2026-03"), "Mar 2026");
  assert.equal(paidPercent(500, 2000), 25);
  assert.equal(paidPercent(1, 3), 33);
  assert.equal(paidPercent(2500, 2000), 100);
  assert.equal(paidPercent(0, 0), 0);
});

test("branch detail is hidden for a filter or a one-branch club, unless rows span branches", () => {
  assert.equal(showBranchDetail({ filtered: true, activeBranches: 4, branchIdsInView: ["a", "b"] }), false);
  assert.equal(showBranchDetail({ filtered: false, activeBranches: 1, branchIdsInView: ["a", "a"] }), false);
  assert.equal(showBranchDetail({ filtered: false, activeBranches: 1, branchIdsInView: ["a", "archived"] }), true);
  assert.equal(showBranchDetail({ filtered: false, activeBranches: 1, branchIdsInView: ["a", null] }), true);
  assert.equal(showBranchDetail({ filtered: false, activeBranches: 4, branchIdsInView: [] }), true);
});
