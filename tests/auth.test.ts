import { test } from "node:test";
import assert from "node:assert/strict";
import { newPasswordSchema, passwordResetRequestSchema, passwordSchema, safeNextPath, signInSchema, signUpSchema } from "../src/lib/validation.ts";
import { AUTH_MESSAGES, LOGIN_NOTICES, authErrorState, fullNameFromMetadata, loginNotice, oauthFailure } from "../src/lib/auth-errors.ts";
import { formValues, parseForm } from "../src/lib/forms.ts";

const signUp = { full_name: "Aisyah Rahman", email: "aisyah@example.com", password: "Silat2026", confirm_password: "Silat2026" };
const errorsFor = (schema: typeof signUpSchema | typeof newPasswordSchema, input: object) => {
  const result = schema.safeParse(input);
  return result.success ? {} : Object.fromEntries(result.error.issues.map((i) => [String(i.path[0]), i.message]));
};

test("sign-up accepts valid details and normalizes email and name", () => {
  const parsed = signUpSchema.parse({ ...signUp, full_name: "  Aisyah Rahman ", email: "  Aisyah@Example.COM " });
  assert.equal(parsed.email, "aisyah@example.com");
  assert.equal(parsed.full_name, "Aisyah Rahman");
});

test("sign-up requires a name, valid email and matching passwords", () => {
  assert.ok(errorsFor(signUpSchema, { ...signUp, full_name: " " }).full_name);
  assert.ok(errorsFor(signUpSchema, { ...signUp, email: "not-an-email" }).email);
  assert.equal(errorsFor(signUpSchema, { ...signUp, confirm_password: "Silat2027" }).confirm_password, "Passwords do not match.");
});

test("password policy: 8–72 characters with a letter and a number", () => {
  for (const weak of ["short1", "allletters", "12345678", "a1".repeat(37)]) assert.equal(passwordSchema.safeParse(weak).success, false, weak);
  for (const ok of ["silat123", "Tae kwon do 2026!", "a1".repeat(36)]) assert.equal(passwordSchema.safeParse(ok).success, true, ok);
});

test("new password must also be confirmed", () => {
  assert.ok(errorsFor(newPasswordSchema, { password: "Silat2026", confirm_password: "silat2026" }).confirm_password);
  assert.equal(newPasswordSchema.safeParse({ password: "Silat2026", confirm_password: "Silat2026" }).success, true);
});

test("sign-in and reset requests validate email; sign-in does not apply the new-password policy", () => {
  assert.equal(signInSchema.safeParse({ email: "a@b.co", password: "x" }).success, true);
  assert.equal(signInSchema.safeParse({ email: "a@b.co", password: "" }).success, false);
  assert.equal(passwordResetRequestSchema.safeParse({ email: "nope" }).success, false);
});

test("post-auth redirects stay on this site", () => {
  assert.equal(safeNextPath("/workspaces/new"), "/workspaces/new");
  assert.equal(safeNextPath("/clubs/x?tab=1"), "/clubs/x?tab=1");
  for (const bad of ["https://evil.example", "//evil.example", "/\\evil.example", "evil", "", null, undefined, "/\nx"]) assert.equal(safeNextPath(bad), "/workspaces", String(bad));
});

test("Supabase auth errors map to friendly messages", () => {
  assert.equal(authErrorState({ code: "user_already_exists" }, "sign-up").fieldErrors?.email?.[0], AUTH_MESSAGES.emailExists);
  assert.equal(authErrorState({ code: "email_exists" }, "sign-up").error, AUTH_MESSAGES.emailExists);
  assert.equal(authErrorState({ code: "weak_password" }, "sign-up").fieldErrors?.password?.[0], AUTH_MESSAGES.weakPassword);
  assert.equal(authErrorState({ code: "email_not_confirmed" }, "sign-in").error, AUTH_MESSAGES.emailNotConfirmed);
  assert.equal(authErrorState({ code: "invalid_credentials", status: 400 }, "sign-in").error, AUTH_MESSAGES.invalidLogin);
  assert.equal(authErrorState({ code: "over_email_send_rate_limit" }, "sign-up").error, AUTH_MESSAGES.rateLimited);
  assert.equal(authErrorState({ status: 429 }, "reset-request").error, AUTH_MESSAGES.rateLimited);
  assert.equal(authErrorState({ code: "same_password" }, "password-update").fieldErrors?.password?.[0], AUTH_MESSAGES.samePassword);
  assert.equal(authErrorState({ code: "unexpected_failure", status: 500 }, "sign-up").error, AUTH_MESSAGES.generic);
});

const formData = (fields: Record<string, string>) => {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) form.set(key, value);
  // React adds framework fields to Server Action submissions; they must be ignored.
  form.set("$ACTION_ID_abc123", "");
  return form;
};

// Regression: password fields were redacted *before* validation, so every valid sign-in failed with
// "This field is required" on the password and the field was cleared.
test("valid sign-in, sign-up and reset submissions parse from FormData", () => {
  const signIn = parseForm(signInSchema, formData({ email: " Owner@Example.com ", password: "Correct1pass" }));
  assert.equal(signIn.ok, true, JSON.stringify(!signIn.ok && signIn.state.fieldErrors));
  if (signIn.ok) {
    assert.deepEqual(signIn.data, { email: "owner@example.com", password: "Correct1pass" });
    assert.equal(signIn.values.password, undefined);
  }
  const register = parseForm(signUpSchema, formData(signUp));
  assert.equal(register.ok, true, JSON.stringify(!register.ok && register.state.fieldErrors));
  if (register.ok) assert.equal(register.data.password, "Silat2026");
  const reset = parseForm(newPasswordSchema, formData({ password: "Silat2026", confirm_password: "Silat2026" }));
  assert.equal(reset.ok, true, JSON.stringify(!reset.ok && reset.state.fieldErrors));
});

test("a failed sign-in keeps the email for refill but never the password", () => {
  const result = parseForm(signInSchema, formData({ email: "owner@example.com", password: "" }));
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.state.values?.email, "owner@example.com");
    assert.equal(result.state.values?.password, undefined);
    assert.ok(result.state.fieldErrors?.password);
    assert.equal(result.state.fieldErrors?.email, undefined);
  }
});

test("passwords are never echoed back in form state", () => {
  const form = new FormData();
  for (const [key, value] of Object.entries({ ...signUp, confirm_password: "different1" })) form.set(key, value);
  assert.deepEqual(Object.keys(formValues(form)).sort(), ["email", "full_name"]);
  const result = parseForm(signUpSchema, form);
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.state.values?.password, undefined);
});

test("Google sign-in failures map to fixed login notices", () => {
  assert.equal(oauthFailure("access_denied"), "oauth_cancelled");
  for (const error of ["server_error", "invalid_request", null]) assert.equal(oauthFailure(error), "oauth");
  assert.equal(loginNotice("oauth_cancelled"), "oauth_cancelled");
  assert.match(LOGIN_NOTICES.oauth_cancelled, /cancelled/);
  // Arbitrary or inherited values from the URL are never rendered.
  for (const bad of ["<script>", "toString", "__proto__", ["oauth"], undefined]) assert.equal(loginNotice(bad), null);
});

test("full name comes from our sign-up metadata or the Google profile", () => {
  assert.equal(fullNameFromMetadata({ full_name: " Aisyah Rahman " }), "Aisyah Rahman");
  assert.equal(fullNameFromMetadata({ name: "Bala Kumar", avatar_url: "x" }), "Bala Kumar");
  assert.equal(fullNameFromMetadata({ full_name: "", name: "Chong Wei" }), "Chong Wei");
  assert.equal(fullNameFromMetadata({ email: "a@b.co" }), null);
  assert.equal(fullNameFromMetadata(null), null);
  assert.equal(fullNameFromMetadata({ name: "x".repeat(200) })?.length, 120);
});
