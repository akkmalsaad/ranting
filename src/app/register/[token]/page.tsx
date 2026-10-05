import { createClient } from "@/lib/supabase/server";
import { registrationTokenSchema, todayInMalaysia } from "@/lib/validation";
import { PublicShell } from "@/components/registrations/public-shell";
import { RegistrationForm } from "@/components/registrations/registration-form";
import { submitRegistration } from "./actions";

export const metadata = { title: "Student registration", robots: { index: false, follow: false } };

const unavailable: Record<string, { title: string; body: string }> = {
  invalid: { title: "Registration link not found", body: "Check the link you received, or ask the club for a new one." },
  disabled: { title: "This link is no longer active", body: "Please ask the club for a new registration link." },
  expired: { title: "This link has expired", body: "Please ask the club for a new registration link." },
  branch_archived: { title: "Registrations are closed", body: "This branch is no longer taking registrations through this link. Please contact the club." },
};

/** Public parent registration (no login). Shows only the club, branch and martial art of an active link. */
export default async function Register({ params }: PageProps<"/register/[token]">) {
  const { token } = await params;
  const db = await createClient();
  const valid = registrationTokenSchema.safeParse(token).success;
  const { data, error } = valid ? await db.rpc("get_registration_link_info", { p_token: token }) : { data: null, error: null };
  const info = valid ? data?.[0] : { state: "invalid", club_name: null, discipline: null, branch_name: null };

  if (error || !info) {
    return <PublicShell><section className="panel"><h1 className="!text-2xl">Registration unavailable</h1><p className="mt-3 text-slate-600">We couldn&apos;t load this registration form. Please try again later.</p></section></PublicShell>;
  }
  if (info.state !== "active") {
    const message = unavailable[info.state] ?? unavailable.invalid;
    return <PublicShell><section className="panel"><h1 className="!text-2xl">{message.title}</h1><p className="mt-3 text-slate-600">{message.body}</p></section></PublicShell>;
  }

  // New id per form view: retrying the same submission never creates second applications.
  const submissionId = crypto.randomUUID();
  return (
    <PublicShell>
      <p className="text-sm font-bold uppercase tracking-[.18em] text-primary">Student registration</p>
      <h1 className="mt-2 !text-3xl">{info.club_name}</h1>
      <p className="mt-2 text-slate-600">{info.discipline} · <span className="font-semibold text-foreground">{info.branch_name}</span></p>
      <p className="mb-6 mt-4 text-sm leading-6 text-slate-600">Fill in your details once, then add each child. The club reviews every registration and will contact you. Your details are shared only with this club.</p>
      <section className="panel"><RegistrationForm action={submitRegistration.bind(null, token, submissionId)} today={todayInMalaysia()} branchName={info.branch_name ?? ""} /></section>
    </PublicShell>
  );
}
