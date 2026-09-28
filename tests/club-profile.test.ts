import { test } from "node:test";
import assert from "node:assert/strict";
import { clubProfileSchema, clubSettingsSchema, malaysianPhoneSchema, malaysianStates, todayInMalaysia } from "../src/lib/validation.ts";
import { LOGO_MAX_BYTES, checkLogo, detectImageType } from "../src/lib/images.ts";

const invalid = (input: Record<string, string>) => {
  const result = clubProfileSchema.safeParse(input);
  return result.success ? [] : result.error.issues.map((i) => String(i.path[0]));
};

test("an empty profile is valid and every field becomes null", () => {
  const parsed = clubProfileSchema.parse({ ros_number: "", postcode: " ", state: "", phone: "", email: "", year_founded: "" });
  assert.equal(parsed.ros_number, null);
  assert.equal(parsed.postcode, null);
  assert.equal(parsed.state, null);
  assert.equal(parsed.year_founded, null);
  // Missing keys (e.g. the Skip path) are treated as empty too.
  assert.deepEqual(Object.values(clubProfileSchema.parse({})).filter((v) => v !== null), []);
});

test("a complete profile is normalized", () => {
  const parsed = clubProfileSchema.parse({
    ros_number: " PPM-001-10-01012020 ", sports_commissioner_number: "PJS/0123/2024", ssm_number: "202301012345 (1234567-A)",
    association: "Persekutuan Silat Kebangsaan", address_line1: "12 Jalan Ampang", address_line2: "", postcode: "50450",
    city: "Kuala Lumpur", state: "kuala-lumpur", phone: "03-2161 2345", email: " Info@Seni.MY ", year_founded: "1998",
  });
  assert.equal(parsed.ros_number, "PPM-001-10-01012020");
  assert.equal(parsed.phone, "0321612345");
  assert.equal(parsed.email, "info@seni.my");
  assert.equal(parsed.year_founded, 1998);
  assert.equal(parsed.address_line2, null);
});

test("postcodes must be exactly 5 digits", () => {
  for (const postcode of ["1234", "123456", "5O450", "50 450"]) assert.deepEqual(invalid({ postcode }), ["postcode"], postcode);
  assert.deepEqual(invalid({ postcode: "01000" }), []);
});

test("phone numbers must be Malaysian", () => {
  for (const ok of ["012-345 6789", "+60 12-345 6789", "60123456789", "03-2161 2345", "011-1234 5678"]) assert.equal(malaysianPhoneSchema.safeParse(ok).success, true, ok);
  for (const bad of ["12345", "+44 20 7946 0958", "0123", "phone", "+60 12 345 6789 999"]) assert.equal(malaysianPhoneSchema.safeParse(bad).success, false, bad);
});

test("emails, years and states are validated", () => {
  assert.deepEqual(invalid({ email: "not-an-email" }), ["email"]);
  const thisYear = Number(todayInMalaysia().slice(0, 4));
  for (const year_founded of ["1899", String(thisYear + 1), "98", "19x8"]) assert.deepEqual(invalid({ year_founded }), ["year_founded"], year_founded);
  assert.deepEqual(invalid({ year_founded: String(thisYear) }), []);
  assert.deepEqual(invalid({ state: "atlantis" }), ["state"]);
  assert.equal(malaysianStates.length, 16); // 13 states + 3 federal territories
});

test("registration numbers reject markup and control characters", () => {
  for (const ros_number of ["<script>", "A", "x".repeat(51), "-leading"]) assert.deepEqual(invalid({ ros_number }), ["ros_number"], ros_number);
});

test("settings require the club name and martial art alongside the optional profile", () => {
  assert.equal(clubSettingsSchema.safeParse({ name: "Seni Club", discipline: "Silat" }).success, true);
  assert.equal(clubSettingsSchema.safeParse({ name: "", discipline: "Silat" }).success, false);
});

const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const jpeg = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0, 0]);
const webp = Uint8Array.from([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]);

test("logo type comes from the file contents, not its name or declared type", () => {
  assert.equal(detectImageType(png), "image/png");
  assert.equal(detectImageType(jpeg), "image/jpeg");
  assert.equal(detectImageType(webp), "image/webp");
  const svg = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
  assert.equal(detectImageType(svg), null);
  assert.equal(detectImageType(new TextEncoder().encode("GIF89a")), null);
});

test("logos must be non-empty images of at most 2 MB", () => {
  assert.deepEqual(checkLogo(png), { ok: true, type: "image/png", extension: "png" });
  assert.equal(checkLogo(new Uint8Array()).ok, false);
  const big = new Uint8Array(LOGO_MAX_BYTES + 1);
  big.set(png);
  assert.equal(checkLogo(big).ok, false);
  const max = new Uint8Array(LOGO_MAX_BYTES);
  max.set(png);
  assert.equal(checkLogo(max).ok, true);
});
