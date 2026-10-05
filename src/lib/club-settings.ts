import "server-only";
import { cache } from "react";
import { clubClient } from "@/lib/clubs";
import { builtinCategories, CUSTOM_CATEGORY, type ClubCategories, type TransactionKind } from "@/lib/finance/values";
import { LEGACY_PAYMENT_METHODS, PAYMENT_METHODS, type PaymentMethod } from "@/lib/fees/values";

// Club settings added by 20261006100000_club_settings_and_categories.sql. Until that migration is
// applied the columns/table don't exist: loaders then report `available: false` and return the
// previous fixed behaviour (no fee defaults, cash/bank transfer/other, built-in categories).

export type ClubSettings = {
  available: boolean;
  /** Prefills Generate monthly fees only; never changes existing fees. */
  monthlyFeeSen: number | null;
  /** Day of the month (1–31; clamped to short months) used to prefill the due date. */
  dueDay: number | null;
  /** Methods offered in Record payment, in display order. */
  paymentMethods: PaymentMethod[];
};

const ALL_METHODS = PAYMENT_METHODS.map((m) => m.value);

export const loadClubSettings = cache(async (clubId: string): Promise<ClubSettings> => {
  const { db } = await clubClient(clubId);
  const { data, error } = await db.from("clubs").select("default_monthly_fee_sen, fee_due_day, payment_methods").eq("id", clubId).maybeSingle();
  if (error || !data) return { available: false, monthlyFeeSen: null, dueDay: null, paymentMethods: LEGACY_PAYMENT_METHODS };
  const chosen = data.payment_methods;
  return {
    available: true,
    monthlyFeeSen: data.default_monthly_fee_sen,
    dueDay: data.fee_due_day,
    paymentMethods: chosen?.length ? ALL_METHODS.filter((m) => chosen.includes(m)) : ALL_METHODS,
  };
});

/**
 * The club's effective finance categories: built-ins with any rename/archive applied, then the
 * club's own categories (oldest first). Archived ones stay listed (flagged) so history and filters
 * keep their names; forms offer only active ones.
 */
export const loadClubCategories = cache(async (clubId: string): Promise<{ available: boolean; categories: ClubCategories }> => {
  const { db } = await clubClient(clubId);
  const { data, error } = await db.from("transaction_categories").select("kind, key, label, archived_at").eq("club_id", clubId).order("created_at").order("key").limit(500);
  if (error) return { available: false, categories: builtinCategories };
  const merge = (kind: TransactionKind) => {
    const rows = data.filter((r) => r.kind === kind);
    const override = new Map(rows.map((r) => [r.key, r]));
    const builtins = builtinCategories[kind].map((c) => {
      const o = override.get(c.value);
      return o ? { ...c, label: o.label, archived: !!o.archived_at } : c;
    });
    const custom = rows.filter((r) => CUSTOM_CATEGORY.test(r.key)).map((r) => ({ value: r.key, label: r.label, archived: !!r.archived_at, custom: true }));
    return [...builtins, ...custom];
  };
  return { available: true, categories: { income: merge("income"), expense: merge("expense") } };
});
