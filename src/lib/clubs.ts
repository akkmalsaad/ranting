import "server-only";
import { cache } from "react";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/supabase/server";
import { idSchema } from "@/lib/validation";

// All helpers are wrapped in React cache(), so a layout and page rendering in the same request
// share one auth check and one membership lookup.

/** Clubs the signed-in user belongs to. RLS limits rows to the user's memberships. */
export const listMyClubs = cache(async () => {
  const { db } = await requireUser();
  const { data, error } = await db.from("clubs").select("id, name, discipline").order("name").limit(100);
  if (error) throw new Error("Unable to load your clubs.");
  return { clubs: data };
});

/**
 * Resolves a club the user can access from an untrusted route parameter. Non-members get a
 * 404 so a club's existence is not revealed. Every page and action in a club awaits this;
 * layouts don't re-render on navigation, so a layout check alone is not enough.
 */
export const requireClub = cache(async (clubId: string) => {
  const { db } = await clubClient(clubId);
  const { data: club, error } = await db.from("clubs").select("id, name, discipline").eq("id", clubId).maybeSingle();
  if (error) throw new Error("Unable to load this club.");
  if (!club) notFound();
  return { db, club };
});

/**
 * Authenticated client for a club route, available before the membership lookup finishes so
 * pages can run their queries alongside requireClub():
 *
 *   const { db } = await clubClient(clubId);
 *   const [{ club }, rows] = await Promise.all([requireClub(clubId), db.from("…").eq("club_id", clubId)]);
 *
 * Safe because every query is also restricted by RLS to clubs the user belongs to, and the page
 * still fails with 404 unless requireClub() succeeds.
 */
export const clubClient = cache(async (clubId: string) => {
  if (!idSchema.safeParse(clubId).success) notFound();
  return requireUser();
});
