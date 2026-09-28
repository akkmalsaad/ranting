import Link from "next/link";
import { redirectIfSignedIn } from "@/lib/supabase/server";
import { AuthShell } from "@/components/auth/auth-shell";
import { SignInForm } from "@/components/auth/auth-forms";
import { GoogleSignIn } from "@/components/auth/google-button";
import { LOGIN_NOTICES, loginNotice } from "@/lib/auth-errors";

export const metadata = { title: "Sign in" };

export default async function Login({ searchParams }: PageProps<"/login">) {
  await redirectIfSignedIn();
  const notice = loginNotice((await searchParams).error);
  return (
    <AuthShell
      title="Welcome back"
      description="Sign in to your club workspace."
      footer={<p>Don&apos;t have an account? <Link href="/signup" className="font-semibold text-primary hover:underline">Create one</Link></p>}
    >
      {notice && (
        <p role="alert" className="mb-6 rounded-xl bg-amber-50 p-4 text-sm text-amber-900">
          {LOGIN_NOTICES[notice]}
          {notice === "link" && <> Sign in, or request a new link from <Link href="/forgot-password" className="font-semibold underline">password reset</Link> or <Link href="/signup/check-email" className="font-semibold underline">email confirmation</Link>.</>}
        </p>
      )}
      <GoogleSignIn />
      <SignInForm />
    </AuthShell>
  );
}
