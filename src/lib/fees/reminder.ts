// Manual WhatsApp fee reminder for a branch's parent group: a general, privacy-safe Bahasa Melayu
// announcement (no student or parent names, no amounts) and the WhatsApp share link. Ranting never
// sends anything itself: the link opens WhatsApp, where the manager picks the group and sends.

const MALAY_MONTHS = ["Januari", "Februari", "Mac", "April", "Mei", "Jun", "Julai", "Ogos", "September", "Oktober", "November", "Disember"];

/** "2026-10" → "Oktober 2026" (the billing period, in Malay for the message). */
export const malayMonthLabel = (month: string) => `${MALAY_MONTHS[Number(month.slice(5, 7)) - 1]} ${month.slice(0, 4)}`;

/** The default reminder text. The signature line is left out if the club name is blank. */
export function feeReminderMessage({ clubName, branchName, month }: { clubName: string; branchName: string; month: string }) {
  const club = clubName.trim();
  return [
    "Assalamualaikum / Salam sejahtera,",
    "",
    `Peringatan mesra kepada ibu bapa / penjaga di ${branchName.trim()}.`,
    "",
    `Masih terdapat bayaran yuran bagi ${malayMonthLabel(month)} yang belum dijelaskan.`,
    "",
    "Mohon ibu bapa / penjaga yang masih mempunyai bayaran tertunggak untuk membuat bayaran apabila berkelapangan.",
    "",
    "Sekiranya bayaran telah dibuat, sila abaikan mesej ini.",
    "",
    "Terima kasih.",
    ...(club ? ["", `— ${club}`] : []),
  ].join("\n");
}

/**
 * WhatsApp's share link with the message and no recipient, so WhatsApp (the app on phones, WhatsApp
 * Web or Desktop on computers) asks the manager to choose a chat or group. Same link format as the
 * registration-link share.
 */
export const whatsappShareUrl = (text: string) => `https://wa.me/?text=${encodeURIComponent(text)}`;
