import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { supabaseConfig } from "./config";
import { tracedFetch } from "./trace";
import type { Database } from "./database.types";

export async function createClient() {
  // Read cookies first so authenticated pages are always rendered per request.
  const store = await cookies();
  const config = supabaseConfig();
  if (!config) redirect("/setup");
  return createServerClient<Database>(config.url, config.key, { global: { fetch: tracedFetch("server") }, cookies: { getAll: () => store.getAll(), setAll(values) { try { values.forEach(({ name, value, options }) => store.set(name, value, options)); } catch { /* Server Component: proxy persists refreshed cookies. */ } } } });
}

/**
 * The signed-in user for this request, resolved once and shared by layouts, pages and helpers.
 *
 * Uses getClaims(): the JWT signature and expiry are verified locally against the project's
 * published ES256 keys (JWKS cached for 10 minutes), so there's no Auth round trip. That is the
 * same check PostgREST applies before RLS, which remains the authorization boundary for all
 * data. Flows that must see a revoked session immediately (e.g. changing a password) call
 * getUser() instead.
 */
export const requireUser = cache(async () => {
  const db = await createClient();
  const { data, error } = await db.auth.getClaims();
  const userId = data?.claims.sub;
  if (error || !userId) redirect("/login");
  return { db, userId };
});

/** Sends already signed-in visitors away from sign-in/sign-up screens. */
export async function redirectIfSignedIn(to = "/workspaces") {
  const db = await createClient();
  const { data } = await db.auth.getClaims();
  if (data?.claims.sub) redirect(to);
}
