import { test } from "node:test";
import assert from "node:assert/strict";
import { formatClassRange, formatClassRangeShort } from "../src/lib/classes-shared.ts";

const range = (start: string, end: string) => formatClassRangeShort({ start_time: start, end_time: end });

test("compact chip times drop :00 on whole hours and show AM/PM once within the same half of the day", () => {
  assert.equal(range("09:00:00", "11:00:00"), "9–11 AM");
  assert.equal(range("09:30:00", "11:00:00"), "9:30–11 AM");
  assert.equal(range("09:00", "10:45"), "9–10:45 AM");
  assert.equal(range("18:30:00", "20:00:00"), "6:30–8 PM");
  assert.equal(range("20:30:00", "22:30:00"), "8:30–10:30 PM");
});

test("compact chip times keep both periods across noon and handle 12 o'clock", () => {
  assert.equal(range("11:00:00", "13:00:00"), "11 AM–1 PM");
  assert.equal(range("11:30:00", "12:30:00"), "11:30 AM–12:30 PM");
  assert.equal(range("12:00:00", "13:30:00"), "12–1:30 PM");
  assert.equal(range("00:00:00", "01:00:00"), "12–1 AM");
  assert.equal(range("23:00:00", "23:59:00"), "11–11:59 PM");
});

test("the full range (popover, table) is unchanged", () => {
  assert.equal(formatClassRange({ start_time: "09:00:00", end_time: "11:00:00" }), "9:00 AM – 11:00 AM");
});
