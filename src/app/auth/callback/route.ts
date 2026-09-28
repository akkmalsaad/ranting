import type { NextRequest } from "next/server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { fullNameFromMetadata, oauthFailure } from "@/lib/auth-errors";

/**
 * OAuth (PKCE) return URL. Exchanges the code for a session using the verifier cookie set by
 * signInWithGoogle, then hands off to /workspaces, which sends users without a club to
 * /workspaces/new and everyone else to their club dashboard.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const code = params.get("code");
  if (!code) redirect(`/login?error=${oauthFailure(params.get("error"))}`);

  const db = await createClient();
  const { data, error } = await db.auth.exchangeCodeForSession(code);
  if (error || !data.user) redirect("/login?error=oauth");

  // Keep one metadata key for the person's name, whichever way they signed up.
  const metadata = data.user.user_metadata;
  const fullName = fullNameFromMetadata(metadata);
  if (fullName && metadata?.full_name !== fullName) await db.auth.updateUser({ data: { full_name: fullName } });

  redirect("/workspaces");
}
