import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

export type BeltLevel = { id: string; name: string; color: string; stripe_color: string | null; archived_at: string | null };

/** The club's belt levels in progression order (active and archived). RLS: club members only. */
export async function listBeltLevels(db: SupabaseClient<Database>, clubId: string): Promise<BeltLevel[]> {
  const { data, error } = await db.from("belt_levels").select("id, name, color, stripe_color, archived_at").eq("club_id", clubId).order("position").limit(200);
  if (error) throw new Error("Unable to load belt levels.");
  return data;
}
