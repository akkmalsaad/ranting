import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { supabaseConfig } from "@/lib/supabase/config";
import { tracedFetch } from "@/lib/supabase/trace";
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const config = supabaseConfig();
  if (config) {
    const db = createServerClient(config.url, config.key, { global: { fetch: tracedFetch("proxy") }, cookies: { getAll: () => request.cookies.getAll(), setAll(values) { values.forEach(({ name, value }) => request.cookies.set(name, value)); response = NextResponse.next({ request }); values.forEach(({ name, value, options }) => response.cookies.set(name, value, options)); } } });
    // Refreshes an expired session and persists cookies. With the project's asymmetric (ES256)
    // JWT keys this verifies locally: no network call except a JWKS fetch cached for 10 minutes.
    await db.auth.getClaims();
  }
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"] };
