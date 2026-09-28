import type { EmailOtpType } from "@supabase/supabase-js";
import type { NextRequest } from "next/server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { safeNextPath } from "@/lib/validation";

const otpTypes: EmailOtpType[] = ["signup", "email", "recovery", "invite", "magiclink", "email_change"];

/**
 * Target of Supabase email links. Supports the recommended token-hash templates
 * (?token_hash=…&type=…) and the default PKCE redirect (?code=…). On success the session
 * cookie is set and the user continues to `next` (same-site paths only).
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const tokenHash = params.get("token_hash");
  const type = otpTypes.find((t) => t === params.get("type"));
  const code = params.get("code");
  const next = type === "recovery" ? "/reset-password" : safeNextPath(params.get("next"), "/workspaces");

  const db = await createClient();
  let verified = false;
  if (tokenHash && type) verified = !(await db.auth.verifyOtp({ type, token_hash: tokenHash })).error;
  else if (code) verified = !(await db.auth.exchangeCodeForSession(code)).error;

  redirect(verified ? next : "/login?error=link");
}
