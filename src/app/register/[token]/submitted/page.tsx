import { CheckCircle2 } from "lucide-react";
import { PublicShell } from "@/components/registrations/public-shell";
import { MAX_REGISTRATION_CHILDREN } from "@/lib/validation";

export const metadata = { title: "Registration submitted", robots: { index: false, follow: false } };

/**
 * Shown after a successful public registration. `n` is the number of children the database saved
 * for this submission (no personal data is in the URL or on this page).
 */
export default async function RegistrationSubmitted({ searchParams }: PageProps<"/register/[token]/submitted">) {
  const n = Number((await searchParams).n);
  const count = Number.isInteger(n) && n >= 1 && n <= MAX_REGISTRATION_CHILDREN ? n : null;
  return (
    <PublicShell>
      <section className="panel flex flex-col items-start gap-4">
        <CheckCircle2 size={32} aria-hidden className="text-primary" />
        <h1 className="!text-2xl">Registration submitted</h1>
        <p className="text-slate-600">
          {count ? `Registration submitted for ${count} ${count === 1 ? "child" : "children"}. Waiting for club approval.` : "Registration submitted. Waiting for club approval."}
        </p>
      </section>
    </PublicShell>
  );
}
