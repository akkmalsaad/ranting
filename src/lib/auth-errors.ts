import type { FormState } from "./forms";

// Maps Supabase Auth errors to user-facing copy without exposing internal messages.
export type AuthErrorLike = { code?: string; status?: number } | null | undefined;
export type AuthFlow = "sign-in" | "sign-up" | "reset-request" | "password-update";

export const AUTH_MESSAGES = {
  emailExists: "An account with this email already exists. Sign in instead, or reset your password.",
  weakPassword: "This password is too weak. Use a longer password that's hard to guess.",
  samePassword: "Choose a password different from your current one.",
  emailNotConfirmed: "Please confirm your email first. Check your inbox (and spam folder) for the confirmation link.",
  invalidLogin: "Incorrect email or password.",
  rateLimited: "Too many attempts. Please wait a few minutes and try again.",
  invalidEmail: "This email address can't be used. Check it and try again.",
  signupDisabled: "New account registration is currently closed.",
  sessionExpired: "Your reset link has expired. Request a new one.",
  generic: "Something went wrong. Please try again.",
} as const;

export function authErrorState(error: AuthErrorLike, flow: AuthFlow): FormState {
  const code = error?.code;
  if (error?.status === 429 || code === "over_request_rate_limit" || code === "over_email_send_rate_limit") return { error: AUTH_MESSAGES.rateLimited };
  switch (code) {
    case "user_already_exists":
    case "email_exists":
      return { error: AUTH_MESSAGES.emailExists, fieldErrors: { email: [AUTH_MESSAGES.emailExists] } };
    case "weak_password":
      return { error: AUTH_MESSAGES.weakPassword, fieldErrors: { password: [AUTH_MESSAGES.weakPassword] } };
    case "same_password":
      return { error: AUTH_MESSAGES.samePassword, fieldErrors: { password: [AUTH_MESSAGES.samePassword] } };
    case "email_not_confirmed":
      return { error: AUTH_MESSAGES.emailNotConfirmed };
    case "invalid_credentials":
      return { error: AUTH_MESSAGES.invalidLogin };
    case "email_address_invalid":
    case "email_address_not_authorized":
      return { error: AUTH_MESSAGES.invalidEmail, fieldErrors: { email: [AUTH_MESSAGES.invalidEmail] } };
    case "signup_disabled":
      return { error: AUTH_MESSAGES.signupDisabled };
    case "session_not_found":
    case "session_expired":
      return { error: AUTH_MESSAGES.sessionExpired };
  }
  // Sign-in failures without a recognised code are still reported as invalid credentials.
  return { error: flow === "sign-in" && error?.status === 400 ? AUTH_MESSAGES.invalidLogin : AUTH_MESSAGES.generic };
}
