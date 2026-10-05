// Branch colour palette and short codes. Branches store a palette key (`branches.color`), never hex;
// the order here is also the fallback order for branches without a saved colour, and must match the
// backfill in supabase/migrations/20261007100000_branch_color_short_code.sql.
// Class strings are literal so Tailwind generates them; there's no dark mode yet.

export const BRANCH_COLOR_KEYS = ["teal", "violet", "amber", "sky", "rose", "emerald", "indigo", "orange"] as const;
export type BranchColorKey = (typeof BRANCH_COLOR_KEYS)[number];

export type BranchTone = {
  key: BranchColorKey;
  label: string;
  /** Chip surface: ~10% tint, darker on hover, dark text (the chip's accent bar uses currentColor). */
  chip: string;
  /** Chip second line: one step lighter than the name, still well above 4.5:1 on the tint. */
  sub: string;
  /** Today's chips: a ring in the branch's darker shade. */
  ring: string;
  /** Solid swatch for dots, the legend and the colour picker. */
  dot: string;
  /** Small label (short-code badge): a stronger tint than the chip, 900 text (AA). */
  badge: string;
};

export const BRANCH_TONES: Record<BranchColorKey, BranchTone> = {
  teal: { key: "teal", label: "Teal", chip: "bg-teal-50 text-teal-900 hover:bg-teal-100", sub: "text-teal-800", ring: "ring-teal-700/45", dot: "bg-teal-600", badge: "bg-teal-100 text-teal-900" },
  violet: { key: "violet", label: "Violet", chip: "bg-violet-50 text-violet-900 hover:bg-violet-100", sub: "text-violet-800", ring: "ring-violet-700/45", dot: "bg-violet-600", badge: "bg-violet-100 text-violet-900" },
  amber: { key: "amber", label: "Amber", chip: "bg-amber-50 text-amber-900 hover:bg-amber-100", sub: "text-amber-800", ring: "ring-amber-700/45", dot: "bg-amber-500", badge: "bg-amber-100 text-amber-900" },
  sky: { key: "sky", label: "Sky", chip: "bg-sky-50 text-sky-900 hover:bg-sky-100", sub: "text-sky-800", ring: "ring-sky-700/45", dot: "bg-sky-600", badge: "bg-sky-100 text-sky-900" },
  rose: { key: "rose", label: "Rose", chip: "bg-rose-50 text-rose-900 hover:bg-rose-100", sub: "text-rose-800", ring: "ring-rose-700/45", dot: "bg-rose-600", badge: "bg-rose-100 text-rose-900" },
  emerald: { key: "emerald", label: "Emerald", chip: "bg-emerald-50 text-emerald-900 hover:bg-emerald-100", sub: "text-emerald-800", ring: "ring-emerald-700/45", dot: "bg-emerald-600", badge: "bg-emerald-100 text-emerald-900" },
  indigo: { key: "indigo", label: "Indigo", chip: "bg-indigo-50 text-indigo-900 hover:bg-indigo-100", sub: "text-indigo-800", ring: "ring-indigo-700/45", dot: "bg-indigo-600", badge: "bg-indigo-100 text-indigo-900" },
  orange: { key: "orange", label: "Orange", chip: "bg-orange-50 text-orange-900 hover:bg-orange-100", sub: "text-orange-800", ring: "ring-orange-700/45", dot: "bg-orange-500", badge: "bg-orange-100 text-orange-900" },
};

export const isBranchColor = (value: unknown): value is BranchColorKey => typeof value === "string" && (BRANCH_COLOR_KEYS as readonly string[]).includes(value);

/**
 * Each branch's colour: its saved palette key, or (none saved) the fallback by branch-id order, so
 * up to eight unsaved branches never share one. Same rule as the migration's backfill.
 */
export function resolveBranchColors(branches: { id: string; color?: string | null }[]) {
  const order = branches.map((b) => b.id).sort();
  return new Map(branches.map((b) => [b.id, isBranchColor(b.color) ? b.color : BRANCH_COLOR_KEYS[order.indexOf(b.id) % BRANCH_COLOR_KEYS.length]]));
}

export const SHORT_CODE_PATTERN = /^[A-Z0-9]{2,4}$/;

/** Suggested short code from a branch name, the same rule as the backfill: initials, else the first two characters. */
export function suggestShortCode(name: string) {
  const upper = name.toUpperCase();
  let code = upper.split(/[^A-Z0-9]+/).filter(Boolean).map((word) => word[0]).join("");
  if (code.length < 2) code = upper.replace(/[^A-Z0-9]/g, "").slice(0, 2);
  code = code.slice(0, 4);
  return code.length >= 2 ? code : "";
}

/**
 * Whether lists show which branch a row belongs to (Classes chips, Fees rows): not when a single
 * branch is filtered, and not for a club with one current branch, unless rows from more than one
 * branch are in view (e.g. classes or fees left on an archived branch).
 */
export function showBranchDetail({ filtered, activeBranches, branchIdsInView }: { filtered: boolean; activeBranches: number; branchIdsInView: Iterable<string | null> }) {
  return !filtered && (activeBranches > 1 || new Set(branchIdsInView).size > 1);
}
