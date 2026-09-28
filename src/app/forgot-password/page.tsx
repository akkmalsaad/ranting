import Link from "next/link";
import { AuthShell } from "@/components/auth/auth-shell";
import { ForgotPasswordForm } from "@/components/auth/auth-forms";

export const metadata = { title: "Forgot password" };

export default function ForgotPassword() {
  return (
    <AuthShell
      title="Reset your password"
      description="Enter your account email and we'll send you a link to choose a new password."
      footer={<p>Remembered it? <Link href="/login" className="font-semibold text-primary hover:underline">Sign in</Link></p>}
    >
      <ForgotPasswordForm />
    </AuthShell>
  );
}
