import { test } from "node:test";
import assert from "node:assert/strict";
import { BRANCH_COLOR_KEYS, resolveBranchColors, suggestShortCode } from "../src/lib/branch-colors.ts";
import { branchSchema } from "../src/lib/validation.ts";

test("suggested short codes: initials, else the first two characters, at most four", () => {
  assert.equal(suggestShortCode("Bukit Antarabangsa"), "BA");
  assert.equal(suggestShortCode("Taman Melawati Ampang"), "TMA");
  assert.equal(suggestShortCode("Setapak"), "SE");
  assert.equal(suggestShortCode("Pusat Latihan Silat Gayong Gombak"), "PLSG");
  assert.equal(suggestShortCode("Seksyen 7 Shah Alam"), "S7SA");
  assert.equal(suggestShortCode("bangsar-south"), "BS");
  assert.equal(suggestShortCode("Ö"), "");
});

test("a saved colour wins; branches without one fall back to the id-order colour", () => {
  const a = "a0000000-0000-4000-8000-000000000000";
  const b = "b0000000-0000-4000-8000-000000000000";
  const c = "c0000000-0000-4000-8000-000000000000";
  // No saved colours: palette order by sorted id, whatever order the branches arrive in.
  assert.deepEqual([...resolveBranchColors([{ id: c }, { id: a }, { id: b }])], [[c, "amber"], [a, "teal"], [b, "violet"]]);
  // Saved colours are used as they are; unknown values fall back.
  assert.deepEqual([...resolveBranchColors([{ id: a, color: "rose" }, { id: b, color: null }, { id: c, color: "magenta" }])], [[a, "rose"], [b, "violet"], [c, "amber"]]);
  assert.equal(BRANCH_COLOR_KEYS.length, 8);
});

test("the branch form stores short codes uppercase and only accepts palette colours", () => {
  const ok = branchSchema.safeParse({ name: "Bukit Antarabangsa", short_code: " ba ", color: "teal" });
  assert.equal(ok.success && ok.data.short_code, "BA");
  assert.equal(ok.success && ok.data.color, "teal");
  const blank = branchSchema.safeParse({ name: "Setapak", short_code: "", color: "" });
  assert.ok(blank.success && blank.data.short_code === null && blank.data.color === null);
  assert.equal(branchSchema.safeParse({ name: "Setapak", short_code: "A" }).success, false);
  assert.equal(branchSchema.safeParse({ name: "Setapak", short_code: "ABCDE" }).success, false);
  assert.equal(branchSchema.safeParse({ name: "Setapak", short_code: "B-A" }).success, false);
  assert.equal(branchSchema.safeParse({ name: "Setapak", color: "#147968" }).success, false);
});
