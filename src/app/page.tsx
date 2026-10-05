import Image, { type StaticImageData } from "next/image";
import Link from "next/link";
import { ArrowRight, LayoutDashboard, LogIn, ShieldCheck } from "lucide-react";
import { assets } from "@/lib/assets";
import { Button } from "@/components/ui/button";

export const metadata = {
  title: { absolute: "Ranting · Martial arts club management" },
  description: "Ranting is a management system for independent martial arts clubs: branches, students, families, income and expenses in one secure club workspace.",
};

type Feature = { title: string; body: string; points: string[] } & ({ image: StaticImageData } | { icon: typeof LayoutDashboard });

// Only features that exist in the app today.
const features: Feature[] = [
  { image: assets.club, title: "Your club workspace", body: "Set up your club in minutes and keep its details in one place.", points: ["Club name, martial art style and logo", "ROS, Sports Commissioner and SSM registration numbers", "Address, contact details and affiliation", "Switch between clubs if you run more than one"] },
  { image: assets.branch, title: "Branches", body: "Every training location, with the details you share with parents.", points: ["Branch address with Malaysian states and federal territories", "Coach name, role, phone and email for each branch", "Archive a branch without losing its history"] },
  { image: assets.student, title: "Students and families", body: "Register students with their guardian contacts and branch.", points: ["Add siblings together, sharing one guardian contact", "Active and inactive status, join date and notes", "Search by name or phone and filter by branch", "Archive and restore students"] },
  { image: assets.ledger, title: "Income and expenses", body: "Record the money your club actually receives and pays out.", points: ["Payments received and expenses in MYR", "Monthly totals, for the whole club or one branch", "Every record keeps who recorded it and when"] },
  { icon: LayoutDashboard, title: "Club dashboard", body: "See how your club is doing at a glance.", points: ["Total students and branches", "Income and expenses this month", "Recently added students", "Filter the overview by branch"] },
  { icon: ShieldCheck, title: "Private by design", body: "Each club's records are kept separate from every other club.", points: ["Only your club's owners can see its records", "Sign in with email or Google", "Works on laptop, tablet and phone"] },
];

const steps = [
  { title: "Create your club", body: "Sign up, name your club and choose your martial art." },
  { title: "Add branches and students", body: "Add your training locations, then register students and their families." },
  { title: "Track your club's money", body: "Record payments received and expenses, and follow the monthly totals." },
];

const LogInButton = ({ className }: { className?: string }) => (
  <Button asChild className={className}><Link href="/login"><LogIn size={16} aria-hidden /> Log in</Link></Button>
);

/** Public homepage for the Ranting system (the app itself starts at /login). */
export default function Home() {
  return (
    <div className="min-h-screen bg-white">
      <header className="sticky top-0 z-20 border-b border-border bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Link href="/" aria-label="Ranting home"><Image src={assets.banner} alt="Ranting" className="h-auto w-32 sm:w-36" priority /></Link>
          <nav aria-label="Account" className="flex items-center gap-2 sm:gap-4">
            <Link href="/signup" className="hidden text-sm font-semibold text-slate-600 hover:text-foreground sm:inline">Create account</Link>
            <LogInButton className="min-h-10 px-4 py-2" />
          </nav>
        </div>
      </header>

      <main>
        <section className="bg-[#071e30] text-white">
          <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-16 sm:px-6 lg:grid-cols-[1.2fr_1fr] lg:py-24">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[.25em] text-emerald-300">Built for martial arts clubs</p>
              <h1 className="mt-6 !text-4xl font-semibold leading-tight tracking-tight sm:!text-5xl lg:!text-6xl">Less admin.<br />More time on the mat.</h1>
              <p className="mt-6 max-w-xl text-lg leading-8 text-slate-300">
                Ranting is a management system for independent martial arts clubs: silat, taekwondo, BJJ, muay thai, karate and more.
                Keep your branches, students, families and club finances together in one secure workspace.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <LogInButton />
                <Button asChild variant="outline" className="border-white/30 bg-transparent text-white hover:bg-white/10"><Link href="/signup">Create an account <ArrowRight size={16} aria-hidden /></Link></Button>
              </div>
              <p className="mt-6 text-sm text-slate-400">Malaysia-first · Amounts in MYR · Works on any device</p>
            </div>
            <div aria-hidden className="grid grid-cols-2 gap-4">
              {[assets.club, assets.branch, assets.student, assets.coach].map((image, i) => (
                <div key={i} className="grid aspect-square place-items-center rounded-3xl bg-white/95 p-6 shadow-[0_20px_50px_-20px_#00000080]">
                  <Image src={image} alt="" className="h-auto w-full max-w-36" />
                </div>
              ))}
            </div>
          </div>
        </section>

        <section aria-labelledby="features-title" className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-20">
          <p className="text-sm font-bold uppercase tracking-[.18em] text-primary">What you can do</p>
          <h2 id="features-title" className="mt-3 !text-3xl !tracking-[-.03em] sm:!text-4xl">Everything your club runs on, in one place</h2>
          <p className="mt-4 max-w-2xl text-slate-600">Each club gets its own private workspace. Here&apos;s what club owners can do in Ranting today.</p>
          <ul className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => (
              <li key={feature.title} className="panel flex flex-col">
                <span className="grid size-14 place-items-center rounded-2xl bg-muted">
                  {"image" in feature ? <Image src={feature.image} alt="" className="size-11" /> : <feature.icon className="text-primary" size={26} aria-hidden />}
                </span>
                <h3 className="mt-5 text-lg font-bold tracking-tight">{feature.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{feature.body}</p>
                <ul className="mt-4 space-y-2 text-sm text-slate-700">
                  {feature.points.map((point) => <li key={point} className="flex gap-2"><span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" />{point}</li>)}
                </ul>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="steps-title" className="border-y border-border bg-background">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-20">
            <h2 id="steps-title" className="!text-3xl !tracking-[-.03em]">Get started in three steps</h2>
            <ol className="mt-10 grid gap-5 md:grid-cols-3">
              {steps.map((step, i) => (
                <li key={step.title} className="panel">
                  <span className="grid size-10 place-items-center rounded-full bg-primary text-sm font-bold text-white">{i + 1}</span>
                  <h3 className="mt-4 font-bold">{step.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{step.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <div className="flex flex-col items-start justify-between gap-6 rounded-3xl bg-[#071e30] p-8 text-white sm:flex-row sm:items-center sm:p-12">
            <div>
              <h2 className="!text-2xl sm:!text-3xl">Ready to run your club with Ranting?</h2>
              <p className="mt-2 text-slate-300">Log in to your club workspace, or create an account to set up your club.</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <LogInButton />
              <Button asChild variant="outline" className="border-white/30 bg-transparent text-white hover:bg-white/10"><Link href="/signup">Create an account</Link></Button>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-8 text-sm text-slate-500 sm:px-6">
          <p>Ranting · Martial arts club management · Malaysia</p>
          <Link href="/login" className="font-semibold text-primary hover:underline">Log in</Link>
        </div>
      </footer>
    </div>
  );
}
