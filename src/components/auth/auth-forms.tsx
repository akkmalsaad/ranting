"use client";
import Link from "next/link";
import { ActionForm } from "@/components/action-form";
import { TextField } from "@/components/field";
import { requestPasswordReset, resendConfirmation, signIn, signUp, updatePassword } from "@/app/auth/actions";
import { PASSWORD_MAX, PASSWORD_MIN, newPasswordSchema, passwordResetRequestSchema, signInSchema, signUpSchema } from "@/lib/validation";

const passwordHint = `At least ${PASSWORD_MIN} characters, including a letter and a number.`;
const EmailField = () => <TextField name="email" label="Email address" type="email" autoComplete="email" required maxLength={254} />;
const NewPasswordFields = () => (
  <>
    <TextField name="password" label="Password" type="password" autoComplete="new-password" required minLength={PASSWORD_MIN} maxLength={PASSWORD_MAX} hint={passwordHint} />
    <TextField name="confirm_password" label="Confirm password" type="password" autoComplete="new-password" required maxLength={PASSWORD_MAX} />
  </>
);

export function SignInForm() {
  return (
    <ActionForm action={signIn} schema={signInSchema} submit="Sign in">
      <EmailField />
      <TextField name="password" label="Password" type="password" autoComplete="current-password" required maxLength={PASSWORD_MAX} />
      <Link href="/forgot-password" className="inline-block text-sm font-medium text-primary hover:underline">Forgot password?</Link>
    </ActionForm>
  );
}

export function SignUpForm() {
  return (
    <ActionForm action={signUp} schema={signUpSchema} submit="Create account">
      <TextField name="full_name" label="Full name" autoComplete="name" required minLength={2} maxLength={120} />
      <EmailField />
      <NewPasswordFields />
    </ActionForm>
  );
}

export function ResendConfirmationForm() {
  return <ActionForm action={resendConfirmation} schema={passwordResetRequestSchema} submit="Resend confirmation email"><EmailField /></ActionForm>;
}

export function ForgotPasswordForm() {
  return <ActionForm action={requestPasswordReset} schema={passwordResetRequestSchema} submit="Send reset link"><EmailField /></ActionForm>;
}

export function ResetPasswordForm() {
  return <ActionForm action={updatePassword} schema={newPasswordSchema} submit="Update password"><NewPasswordFields /></ActionForm>;
}
