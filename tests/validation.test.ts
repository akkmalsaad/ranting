import { test } from "node:test";
import assert from "node:assert/strict";
import { clubSchema, branchSchema, studentSchema, pageNumber, searchTerm, todayInMalaysia } from "../src/lib/validation.ts";
import { parseForm } from "../src/lib/forms.ts";

const student = { full_name: "Aisyah Rahman", status: "active", join_date: "2026-01-15" };

test("club names are normalized and bounded", () => {
  assert.equal(clubSchema.parse({ name: "  Seni Club  ", discipline: "Silat" }).name, "Seni Club");
  assert.equal(clubSchema.safeParse({ name: " ", discipline: "Silat" }).success, false);
  assert.equal(clubSchema.safeParse({ name: "a".repeat(121), discipline: "Silat" }).success, false);
});

test("branches accept an optional bounded address", () => {
  assert.equal(branchSchema.parse({ name: "Central" }).address, "");
  assert.equal(branchSchema.safeParse({ name: "Central", address: "x".repeat(501) }).success, false);
});

test("students: blank optional fields become null and phones are normalized", () => {
  const s = studentSchema.parse({ ...student, date_of_birth: "", gender: "", phone: "012-345 6789", guardian_name: " ", guardian_phone: "+60 12-345 6789", branch_id: "", notes: "" });
  assert.equal(s.date_of_birth, null);
  assert.equal(s.gender, null);
  assert.equal(s.branch_id, null);
  assert.equal(s.guardian_name, null);
  assert.equal(s.phone, "0123456789");
  assert.equal(s.guardian_phone, "+60123456789");
});

test("students reject invalid identifiers, genders, statuses and phones", () => {
  for (const bad of [{ branch_id: "other-club" }, { gender: "other" }, { status: "archived" }, { phone: "12ab" }, { join_date: "2026-02-30" }]) {
    assert.equal(studentSchema.safeParse({ ...student, ...bad }).success, false, JSON.stringify(bad));
  }
});

test("date of birth cannot be in the future or after the join date", () => {
  assert.equal(studentSchema.safeParse({ ...student, date_of_birth: "2999-01-01", join_date: "2999-01-02" }).success, false);
  assert.equal(studentSchema.safeParse({ ...student, date_of_birth: "2026-02-01" }).success, false);
  assert.equal(studentSchema.safeParse({ ...student, date_of_birth: "2015-06-01" }).success, true);
});

test("today is computed in Malaysia time, not UTC", () => {
  // 2026-09-28 17:30 UTC is already 29 September in Kuala Lumpur (UTC+8).
  assert.equal(todayInMalaysia(new Date("2026-09-28T17:30:00Z")), "2026-09-29");
  assert.equal(todayInMalaysia(new Date("2026-09-28T15:59:00Z")), "2026-09-28");
});

test("parseForm returns field errors and the submitted values", () => {
  const form = new FormData();
  form.set("name", "A");
  form.set("discipline", "Silat");
  const result = parseForm(clubSchema, form);
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.ok(result.state.fieldErrors?.name?.length);
    assert.equal(result.state.values?.discipline, "Silat");
  }
});

test("pagination and search cannot expand an unbounded query", () => {
  for (const value of [-1, Infinity, "x", 1.5]) assert.equal(pageNumber(value), 1);
  assert.equal(pageNumber(9999999), 100000);
  assert.equal(searchTerm(" %_\\,() "), "");
  assert.equal(searchTerm("x".repeat(200)).length, 80);
});
