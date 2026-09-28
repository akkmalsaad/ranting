import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { AuthShell } from "@/components/auth/auth-shell";
import { ResetPasswordForm } from "@/components/auth/auth-forms";

export const metadata = { title: "Choose a new password" };

/** Reached from the password reset email via /auth/confirm, which signs the user in first. */
export default async function ResetPassword() {
  const db = await createClient();
  const { data } = await db.auth.getUser();
  if (!data.user) {
    return (
      <AuthShell title="Link expired" description="This password reset link is invalid or has expired." footer={<p><Link href="/login" className="font-semibold text-primary hover:underline">Back to sign in</Link></p>}>
        <Link href="/forgot-password" className="font-semibold text-primary hover:underline">Request a new reset link</Link>
      </AuthShell>
    );
  }
  return (
    <AuthShell title="Choose a new password" description="Enter a new password for your Ranting account.">
      <ResetPasswordForm />
    </AuthShell>
  );
}
