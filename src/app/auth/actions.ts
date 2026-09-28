"use server";
import { redirect } from "next/navigation";
import { parseForm, type FormState } from "@/lib/forms";
import { AUTH_MESSAGES, authErrorState } from "@/lib/auth-errors";
import { siteUrl } from "@/lib/site-url";
import { createClient } from "@/lib/supabase/server";
import { newPasswordSchema, passwordResetRequestSchema, signInSchema, signUpSchema } from "@/lib/validation";

const confirmUrl = (next: string) => `${siteUrl()}/auth/confirm?next=${encodeURIComponent(next)}`;

export async function signIn(_: FormState, form: FormData): Promise<FormState> {
  const parsed = parseForm(signInSchema, form);
  if (!parsed.ok) return parsed.state;
  const db = await createClient();
  const { error } = await db.auth.signInWithPassword(parsed.data);
  if (error) return { ...authErrorState(error, "sign-in"), values: parsed.values };
  redirect("/workspaces");
}

export async function signUp(_: FormState, form: FormData): Promise<FormState> {
  const parsed = parseForm(signUpSchema, form);
  if (!parsed.ok) return parsed.state;
  const { full_name, email, password } = parsed.data;
  const db = await createClient();
  const { data, error } = await db.auth.signUp({ email, password, options: { data: { full_name }, emailRedirectTo: confirmUrl("/workspaces/new") } });
  if (error) return { ...authErrorState(error, "sign-up"), values: parsed.values };
  // With email confirmation on, Supabase returns a user without identities for an already-registered email.
  if (data.user && data.user.identities?.length === 0) return { ...authErrorState({ code: "user_already_exists" }, "sign-up"), values: parsed.values };
  if (data.session) redirect("/workspaces/new");
  redirect("/signup/check-email");
}

export async function resendConfirmation(_: FormState, form: FormData): Promise<FormState> {
  const parsed = parseForm(passwordResetRequestSchema, form);
  if (!parsed.ok) return parsed.state;
  const db = await createClient();
  const { error } = await db.auth.resend({ type: "signup", email: parsed.data.email, options: { emailRedirectTo: confirmUrl("/workspaces/new") } });
  if (error && (error.status === 429 || error.code?.startsWith("over_"))) return { ...authErrorState(error, "sign-up"), values: parsed.values };
  // Same response whether or not the address has a pending account, so emails can't be probed.
  return { success: "If that email has an unconfirmed account, we've sent a new confirmation link." };
}

export async function requestPasswordReset(_: FormState, form: FormData): Promise<FormState> {
  const parsed = parseForm(passwordResetRequestSchema, form);
  if (!parsed.ok) return parsed.state;
  const db = await createClient();
  const { error } = await db.auth.resetPasswordForEmail(parsed.data.email, { redirectTo: confirmUrl("/reset-password") });
  if (error && (error.status === 429 || error.code?.startsWith("over_"))) return { ...authErrorState(error, "reset-request"), values: parsed.values };
  if (error && error.code !== "user_not_found") return { error: AUTH_MESSAGES.generic, values: parsed.values };
  return { success: "If an account exists for that email, we've sent a password reset link. Check your inbox and spam folder." };
}

export async function updatePassword(_: FormState, form: FormData): Promise<FormState> {
  const parsed = parseForm(newPasswordSchema, form);
  if (!parsed.ok) return parsed.state;
  const db = await createClient();
  const { data } = await db.auth.getUser();
  if (!data.user) return { error: AUTH_MESSAGES.sessionExpired };
  const { error } = await db.auth.updateUser({ password: parsed.data.password });
  if (error) return authErrorState(error, "password-update");
  redirect("/workspaces");
}

/** Starts Google OAuth (PKCE). The code verifier cookie is set here; /auth/callback completes it. */
export async function signInWithGoogle() {
  const db = await createClient();
  const { data, error } = await db.auth.signInWithOAuth({ provider: "google", options: { redirectTo: `${siteUrl()}/auth/callback` } });
  if (error || !data.url) redirect("/login?error=oauth");
  redirect(data.url);
}

export async function signOut() {
  const db = await createClient();
  const { error } = await db.auth.signOut();
  if (error) throw new Error("Unable to sign out. Please try again.");
  redirect("/login");
}
