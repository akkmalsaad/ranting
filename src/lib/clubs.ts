import "server-only";
import { cache } from "react";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/supabase/server";
import { idSchema } from "@/lib/validation";

/** Clubs the signed-in user belongs to. RLS limits rows to the user's memberships. */
export const listMyClubs = cache(async () => {
  const { db, user } = await requireUser();
  const { data, error } = await db.from("clubs").select("id, name, discipline").order("name").limit(100);
  if (error) throw new Error("Unable to load your clubs.");
  return { db, user, clubs: data };
});

/**
 * Resolves a club the user can access from an untrusted route parameter. Non-members get a
 * 404 so a club's existence is not revealed. Every page and action in a club calls this.
 */
export const requireClub = cache(async (clubId: string) => {
  const { db, user } = await requireUser();
  if (!idSchema.safeParse(clubId).success) notFound();
  const { data: club, error } = await db.from("clubs").select("id, name, discipline").eq("id", clubId).maybeSingle();
  if (error) throw new Error("Unable to load this club.");
  if (!club) notFound();
  return { db, user, club };
});
