import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { supabaseConfig } from "./config";
import type { Database } from "./database.types";
export async function createClient() {
  // Read cookies first so authenticated pages are always rendered per request.
  const store = await cookies();
  const config = supabaseConfig();
  if (!config) redirect("/setup");
  return createServerClient<Database>(config.url, config.key, { cookies: { getAll: () => store.getAll(), setAll(values) { try { values.forEach(({ name, value, options }) => store.set(name, value, options)); } catch { /* Server Component: proxy persists refreshed cookies. */ } } } });
}
export const requireUser = cache(async () => {
  const db = await createClient();
  const { data, error } = await db.auth.getUser();
  if (error || !data.user) redirect("/login");
  return { db, user: data.user };
});
