import { test } from "node:test";
import assert from "node:assert/strict";
import { feeReminderMessage, malayMonthLabel, whatsappShareUrl } from "../src/lib/fees/reminder.ts";
import { feeReminderSchema } from "../src/lib/fees/values.ts";

test("the reminder is a general Malay message with the branch, period and club only", () => {
  const text = feeReminderMessage({ clubName: " Seni Silat Gombak ", branchName: "Bandar Baru Bangi", month: "2026-10" });
  assert.match(text, /^Assalamualaikum \/ Salam sejahtera,\n\nPeringatan mesra kepada ibu bapa \/ penjaga di Bandar Baru Bangi\./);
  assert.match(text, /bayaran yuran bagi Oktober 2026 yang belum dijelaskan\./);
  assert.match(text, /Terima kasih\.\n\n— Seni Silat Gombak$/);
  assert.doesNotMatch(text, /RM|\d+ (students|pelajar)/);
  // Without a club name the signature line is left out.
  assert.match(feeReminderMessage({ clubName: "  ", branchName: "Setapak", month: "2026-03" }), /Mac 2026[\s\S]*Terima kasih\.$/);
});

test("month labels, the share link and the request shape", () => {
  assert.equal(malayMonthLabel("2026-08"), "Ogos 2026");
  assert.equal(malayMonthLabel("2027-12"), "Disember 2027");
  assert.equal(whatsappShareUrl("Salam & terima kasih\n— Kelab"), "https://wa.me/?text=Salam%20%26%20terima%20kasih%0A%E2%80%94%20Kelab");
  assert.equal(feeReminderSchema.safeParse({ branch_id: "", month: "2026-10" }).success, false); // never "all branches"
  assert.equal(feeReminderSchema.safeParse({ branch_id: "00000000-0000-4000-8000-000000000001", month: "2026-13" }).success, false);
  assert.equal(feeReminderSchema.safeParse({ branch_id: "00000000-0000-4000-8000-000000000001", month: "2026-10" }).success, true);
});
