import Image from "next/image";
import Link from "next/link";
import { Building2, ShieldCheck } from "lucide-react";
import { assets } from "@/lib/assets";
import { listMyClubs } from "@/lib/clubs";
import { signOut } from "@/app/auth/actions";
import { Button } from "@/components/ui/button";
import { ClubForm } from "@/components/clubs/club-form";
import { createClub } from "../actions";

export const metadata = { title: "Create your club" };

export default async function NewClub() {
  const { clubs } = await listMyClubs();
  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col justify-center px-6 py-12">
      <header className="mb-12 flex items-center justify-between gap-6">
        <Image src={assets.banner} alt="Ranting" className="h-auto w-44" priority />
        <form action={signOut}><Button variant="outline">Sign out</Button></form>
      </header>
      <div className="grid gap-10 md:grid-cols-[1.1fr_1fr]">
        <section>
          <p className="mb-4 text-sm font-bold uppercase tracking-[.18em] text-primary">{clubs.length ? "Add another club" : "Your club starts here"}</p>
          <h1 className="!text-5xl leading-tight">Set up your<br />club workspace.</h1>
          <p className="mt-6 max-w-md leading-7 text-slate-600">Give your club a name. You can add branches and students next.</p>
          <div className="mt-8 flex items-center gap-3 text-sm text-primary"><ShieldCheck size={20} aria-hidden /> Only you can see this club&apos;s records.</div>
          {clubs.length > 0 && <Link href={`/clubs/${clubs[0].id}`} className="mt-6 inline-block text-sm font-semibold text-primary underline">Back to your clubs</Link>}
        </section>
        <section className="panel">
          <Building2 className="mb-5 text-primary" aria-hidden />
          <h2>Create your club</h2>
          <p className="mb-6 mt-3 text-sm leading-6 text-slate-600">You&apos;ll be the club owner.</p>
          <ClubForm action={createClub} />
        </section>
      </div>
    </main>
  );
}
