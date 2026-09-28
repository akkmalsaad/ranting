import "server-only";

/**
 * Public origin used in auth email links. Configured explicitly (not taken from the request Host
 * header) so links can't be pointed at another domain. Must also be allow-listed in Supabase Auth.
 */
export function siteUrl() {
  const configured = process.env.SITE_URL?.trim().replace(/\/+$/, "");
  if (configured) return configured;
  if (process.env.NODE_ENV !== "production") return "http://localhost:3000";
  throw new Error("SITE_URL is not configured.");
}
