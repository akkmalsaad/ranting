import Link from "next/link";
import { redirectIfSignedIn } from "@/lib/supabase/server";
import { AuthShell } from "@/components/auth/auth-shell";
import { SignUpForm } from "@/components/auth/auth-forms";

export const metadata = { title: "Create account" };

export default async function SignUp() {
  await redirectIfSignedIn();
  return (
    <AuthShell
      title="Create your account"
      description="Set up Ranting for your club in a few minutes."
      footer={<p>Already have an account? <Link href="/login" className="font-semibold text-primary hover:underline">Sign in</Link></p>}
    >
      <SignUpForm />
    </AuthShell>
  );
}
