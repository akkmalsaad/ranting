"use server";
import { revalidatePath } from "next/cache";
import type { PostgrestError } from "@supabase/supabase-js";
import { parseForm, type FormState } from "@/lib/forms";
import { requireClub } from "@/lib/clubs";
import { loadClubCategories } from "@/lib/club-settings";
import { CUSTOM_CATEGORY, transactionCategories, type TransactionKind } from "@/lib/finance/values";
import { PAYMENT_METHODS } from "@/lib/fees/values";
import { categoryNameSchema, feeDefaultsSchema } from "@/lib/settings-values";

// Settings → Fees & Payments and Finance. Bound club ids, kinds and keys are untrusted:
// requireClub re-checks membership; RLS (owner-only updates and inserts) and the column grants
// enforce ownership in the database; key and kind are validated here and by check constraints.

/** The columns/table come from a migration that may not be applied yet. */
const NEEDS_UPDATE = "This setting needs a database update before it can be saved. Please ask your administrator to apply the latest migration.";
const missingSchema = (error: PostgrestError) => ["42703", "42P01", "PGRST204", "PGRST205"].includes(error.code);
const failure = (error: PostgrestError, what: string, values?: Record<string, string>): FormState =>
  missingSchema(error) ? { error: NEEDS_UPDATE, values }
  : error.code === "42501" ? { error: `Only club owners can change ${what}.`, values }
  : { error: `We couldn't save ${what}. Please try again.`, values };

const refresh = (clubId: string) => revalidatePath(`/clubs/${clubId}`, "layout");
const isKind = (kind: string): kind is TransactionKind => kind === "income" || kind === "expense";
const isBuiltin = (kind: TransactionKind, key: string) => transactionCategories[kind].some((c) => c.value === key);

/** Monthly fee defaults (prefill Generate monthly fees only). */
export async function saveFeeDefaults(clubId: string, _: FormState, form: FormData): Promise<FormState> {
  const { db, club } = await requireClub(clubId);
  const parsed = parseForm(feeDefaultsSchema, form);
  if (!parsed.ok) return parsed.state;
  const { data, error } = await db.from("clubs").update({ default_monthly_fee_sen: parsed.data.amount, fee_due_day: parsed.data.due_day }).eq("id", club.id).select("id");
  if (error || !data.length) return error ? failure(error, "fee defaults", parsed.values) : { error: "We couldn't save fee defaults. Please try again.", values: parsed.values };
  refresh(club.id);
  return { saved: { count: 1, params: { notice: "fees-saved" } } };
}

/** Accepted payment methods (at least one). Past payments keep their recorded method. */
export async function savePaymentMethods(clubId: string, _: FormState, form: FormData): Promise<FormState> {
  const { db, club } = await requireClub(clubId);
  const methods = PAYMENT_METHODS.map((m) => m.value).filter((m) => form.get(`method_${m}`) === "on");
  if (!methods.length) return { error: "Keep at least one payment method." };
  const { data, error } = await db.from("clubs").update({ payment_methods: methods }).eq("id", club.id).select("id");
  if (error || !data.length) return error ? failure(error, "payment methods") : { error: "We couldn't save payment methods. Please try again." };
  refresh(club.id);
  return { saved: { count: 1, params: { notice: "methods-saved" } } };
}

/** Names already used by this kind's active categories (case-insensitive), excluding `key`. */
async function nameTaken(clubId: string, kind: TransactionKind, label: string, key?: string) {
  const { categories } = await loadClubCategories(clubId);
  return categories[kind].some((c) => !c.archived && c.value !== key && c.label.toLowerCase() === label.toLowerCase());
}

export async function addCategory(clubId: string, kind: string, _: FormState, form: FormData): Promise<FormState> {
  const { db, club } = await requireClub(clubId);
  if (!isKind(kind)) return { error: "Choose income or expenses." };
  const parsed = parseForm(categoryNameSchema, form);
  if (!parsed.ok) return parsed.state;
  if (await nameTaken(club.id, kind, parsed.data.label)) return { error: "Please correct the highlighted fields.", fieldErrors: { label: ["Another active category already uses this name."] }, values: parsed.values };
  // Generated key; labels can change later without touching any record.
  const key = `custom_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
  const { error } = await db.from("transaction_categories").insert({ club_id: club.id, kind, key, label: parsed.data.label });
  if (error) return failure(error, "categories", parsed.values);
  refresh(club.id);
  return { success: `“${parsed.data.label}” added.` };
}

/** Renames a category. A built-in one gets an override row the first time. Records keep their key. */
export async function renameCategory(clubId: string, kind: string, key: string, _: FormState, form: FormData): Promise<FormState> {
  const { db, club } = await requireClub(clubId);
  if (!isKind(kind) || !(isBuiltin(kind, key) || CUSTOM_CATEGORY.test(key))) return { error: "This category no longer exists." };
  const parsed = parseForm(categoryNameSchema, form);
  if (!parsed.ok) return parsed.state;
  if (await nameTaken(club.id, kind, parsed.data.label, key)) return { error: "Please correct the highlighted fields.", fieldErrors: { label: ["Another active category already uses this name."] }, values: parsed.values };
  const label = parsed.data.label;
  const { data, error } = await db.from("transaction_categories").update({ label }).eq("club_id", club.id).eq("kind", kind).eq("key", key).select("key");
  if (error) return failure(error, "categories", parsed.values);
  if (!data.length) {
    if (!isBuiltin(kind, key)) return { error: "This category no longer exists." };
    const inserted = await db.from("transaction_categories").insert({ club_id: club.id, kind, key, label });
    if (inserted.error) return failure(inserted.error, "categories", parsed.values);
  }
  refresh(club.id);
  return { saved: { count: 1 }, success: "Category renamed." };
}

/** Archives or restores a category. Nothing is deleted; past records keep it. One stays active per kind. */
export async function setCategoryArchived(clubId: string, kind: string, key: string, archived: boolean): Promise<FormState> {
  const { db, club } = await requireClub(clubId);
  if (!isKind(kind) || !(isBuiltin(kind, key) || CUSTOM_CATEGORY.test(key))) return { error: "This category no longer exists." };
  const { categories } = await loadClubCategories(club.id);
  const current = categories[kind].find((c) => c.value === key);
  if (!current) return { error: "This category no longer exists." };
  if (archived && categories[kind].filter((c) => !c.archived).length <= 1) return { error: "Keep at least one active category." };
  if (!archived && await nameTaken(club.id, kind, current.label, key)) return { error: "An active category already uses this name. Rename one of them first." };
  const archived_at = archived ? new Date().toISOString() : null;
  const { data, error } = await db.from("transaction_categories").update({ archived_at }).eq("club_id", club.id).eq("kind", kind).eq("key", key).select("key");
  if (error) return failure(error, "categories");
  if (!data.length) {
    if (!isBuiltin(kind, key)) return { error: "This category no longer exists." };
    const inserted = await db.from("transaction_categories").insert({ club_id: club.id, kind, key, label: current.label, archived_at });
    if (inserted.error) return failure(inserted.error, "categories");
  }
  refresh(club.id);
  return { success: archived ? "Category archived." : "Category restored." };
}
