import Link from "next/link";
import { listMyClubs } from "@/lib/clubs";
import { Modal } from "@/components/ui/modal";
import { ClubForm } from "@/components/clubs/club-form";
import { OnboardingShell } from "@/components/clubs/onboarding-shell";
import { createClub } from "../actions";

export const metadata = { title: "Create your club" };

/**
 * Onboarding step 1. A first club is required, so the modal can't be dismissed; owners adding
 * another club can cancel back to their workspace.
 */
export default async function NewClub() {
  const { clubs } = await listMyClubs();
  const cancelHref = clubs.length ? `/clubs/${clubs[0].id}` : undefined;
  return (
    <>
      <OnboardingShell />
      <Modal labelledBy="onboarding-title" dismissHref={cancelHref}>
        <p className="text-sm font-bold uppercase tracking-[.18em] text-primary">Step 1 of 2</p>
        <h1 id="onboarding-title" className="mt-2 !text-3xl">{clubs.length ? "Add another club" : "Set up your club"}</h1>
        <p className="mb-6 mt-2 text-slate-600">Start with the basics. You&apos;ll be the club owner.</p>
        <ClubForm action={createClub} submit="Continue" footer={cancelHref && <Link href={cancelHref} className="px-3 text-sm font-medium text-slate-600 hover:underline">Cancel</Link>} />
      </Modal>
    </>
  );
}
