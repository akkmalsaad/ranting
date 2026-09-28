import Link from "next/link";
import { MailCheck } from "lucide-react";
import { AuthShell } from "@/components/auth/auth-shell";
import { ResendConfirmationForm } from "@/components/auth/auth-forms";

export const metadata = { title: "Check your email" };

export default function CheckEmail() {
  return (
    <AuthShell
      title="Check your email"
      description={<><MailCheck className="mb-3 text-primary" aria-hidden />We&apos;ve sent you a confirmation link. Open it to activate your account, and you&apos;ll go straight to setting up your club.</>}
      footer={<p><Link href="/login" className="font-semibold text-primary hover:underline">Back to sign in</Link></p>}
    >
      <details className="rounded-xl border border-border bg-white p-4">
        <summary className="cursor-pointer text-sm font-semibold">Didn&apos;t get the email?</summary>
        <p className="my-4 text-sm text-slate-600">Check your spam folder first. You can also request a new link.</p>
        <ResendConfirmationForm />
      </details>
    </AuthShell>
  );
}
