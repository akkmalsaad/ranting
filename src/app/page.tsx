import Image from "next/image";
import Link from "next/link";
import { ArrowDown, ArrowRight, Banknote, CalendarDays, Check, LayoutDashboard, MapPin, MessageCircle, MonitorSmartphone, Phone, Receipt, Share2, Users, Wallet, type LucideIcon } from "lucide-react";
import { assets } from "@/lib/assets";
import { buttonVariants } from "@/components/ui/button";
import { SmoothScrollLink } from "@/components/marketing/smooth-scroll-link";
import { ActivityPreview, ClassesPreview, DashboardPreview, FeesPreview, FinancePreview } from "@/components/marketing/product-previews";
import { cn } from "@/lib/utils";

export const metadata = {
  title: { absolute: "Ranting · Martial arts club management" },
  description: "Manage branches, students, classes, fees and club finances from one secure workspace built for martial arts clubs. Malaysia-first, in MYR.",
};

// Only features that exist in the app today.
const features: { icon: LucideIcon; title: string; body: string }[] = [
  { icon: Users, title: "Students", body: "Keep student profiles, guardian contacts, branch assignments and belt levels organised in one place." },
  { icon: MapPin, title: "Branches", body: "Run several training locations, each with its own address, coach contact, colour and short code." },
  { icon: CalendarDays, title: "Classes", body: "Schedule one-off or weekly classes per branch and see them all on one calendar." },
  { icon: Receipt, title: "Fees", body: "Charge monthly and one-off fees, record payments and see who is overdue at a glance." },
  { icon: Wallet, title: "Finance", body: "Record income and expenses in MYR, with monthly totals by category and branch." },
  { icon: Share2, title: "Parent registration", body: "Share a branch registration link by WhatsApp or QR code; you approve each new student." },
];

// Alternating rows: copy | preview, then preview | copy, and so on (lg and up); stacked copy-first below.
const showcase: { id: string; icon: LucideIcon; label: string; title: string; body: string; points: string[]; preview: React.ReactNode }[] = [
  { id: "dashboard", icon: LayoutDashboard, label: "Dashboard", title: "Your whole club at a glance", body: "See students, income, expenses, pending registrations and club activity at a glance.", points: ["Monthly income, expenses and net cash flow", "New parent registrations waiting for review", "Filter everything by branch"], preview: <ActivityPreview /> },
  { id: "fees", icon: Receipt, label: "Fees", title: "Know who has paid, and who hasn't", body: "Track monthly and one-off fees, payments, outstanding balances and overdue accounts.", points: ["Generate monthly fees for active students in one step", "Partial payments, recorded straight into Finance", "Overdue fees flagged in Malaysia time"], preview: <FeesPreview /> },
  { id: "classes", icon: CalendarDays, label: "Classes", title: "Plan and manage classes with a clear calendar", body: "Organise recurring and one-off classes by branch, see your schedule at a glance, and keep completed sessions easy to track.", points: ["Schedule recurring and one-off classes", "Keep branch schedules organised in one calendar", "Track completed and past sessions at a glance"], preview: <ClassesPreview /> },
  { id: "finance", icon: Wallet, label: "Finance", title: "Understand your club's money", body: "Record income and expenses and understand your club's financial performance.", points: ["Breakdowns by category, branch and month", "Year-to-date view with month-by-month totals", "Export to CSV for your accountant"], preview: <FinancePreview /> },
];

const disciplines = ["Silat", "Taekwondo", "BJJ", "Muay Thai", "Karate", "Other martial arts"];

const malaysia: { icon: LucideIcon; title: string; body: string }[] = [
  { icon: Banknote, title: "MYR throughout", body: "Fees, payments, income and expenses are all tracked in ringgit." },
  { icon: Phone, title: "Local dates and numbers", body: "Malaysia time for due dates, and phone numbers like 012-345 6789." },
  { icon: MapPin, title: "Branch-based clubs", body: "Branch addresses with Malaysian states and federal territories." },
  { icon: MessageCircle, title: "WhatsApp-friendly sign-ups", body: "Send parents a registration link they can open on any phone." },
  { icon: MonitorSmartphone, title: "Any device", body: "Works on desktop, tablet and mobile, with no app to install." },
];

const startClass = buttonVariants();
/** On navy: a white primary button (the navy default would disappear into the background). */
const startOnNavy = cn(buttonVariants(), "bg-white text-navy shadow-none hover:bg-slate-100");
const SectionHeading = ({ id, eyebrow, title, body }: { id: string; eyebrow?: string; title: string; body?: string }) => (
  <div className="max-w-2xl">
    {eyebrow && <p className="text-sm font-bold uppercase tracking-[.18em] text-primary">{eyebrow}</p>}
    <h2 id={id} className={cn("text-3xl! leading-tight tracking-[-.03em]! sm:text-4xl!", eyebrow && "mt-3")}>{title}</h2>
    {body && <p className="mt-4 text-[1.0625rem] leading-7 text-slate-600">{body}</p>}
  </div>
);

/** Public homepage for Ranting (the app itself starts at /login and /signup). */
export default function Home() {
  return (
    <div className="min-h-screen bg-white">
      <header className="sticky top-0 z-20 border-b border-border bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <Link href="/" aria-label="Ranting home" className="shrink-0"><Image src={assets.banner} alt="Ranting" className="h-auto w-28 sm:w-36" priority /></Link>
          <nav aria-label="Account" className="flex items-center gap-1.5 sm:gap-3">
            <Link href="/login" className={cn(buttonVariants({ variant: "ghost" }), "min-h-10 px-3 sm:px-4")}>Log in</Link>
            <Link href="/signup" className={cn(startClass, "min-h-10 px-4")}>Start for free</Link>
          </nav>
        </div>
      </header>

      <main>
        {/* Hero: message and one conversion block on the left, the product on the right. */}
        <section aria-labelledby="hero-title" className="bg-navy text-white">
          <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-14 sm:px-6 sm:py-16 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.08fr)] lg:gap-14 lg:py-20">
            <div className="min-w-0">
              <p className="text-sm font-semibold uppercase tracking-[.25em] text-emerald-300">Built for martial arts clubs</p>
              <h1 id="hero-title" className="mt-5 text-4xl! font-semibold leading-[1.08] tracking-tight sm:text-5xl! lg:text-[3.5rem]!">Less admin.<br />More time on the mat.</h1>
              <p className="mt-5 max-w-xl text-lg leading-8 text-slate-300">Manage branches, students, classes, fees and club finances from one secure workspace built for martial arts clubs.</p>

              <div className="mt-8 max-w-xl rounded-2xl border border-white/10 bg-white/[0.04] p-5 sm:p-6">
                <p className="text-lg font-semibold tracking-[-0.01em]">Ready to spend less time on admin?</p>
                <p className="mt-1 text-[0.9375rem] text-slate-300">Start managing your club with Ranting for free.</p>
                <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-5">
                  <Link href="/signup" className={cn(startOnNavy, "w-full sm:w-auto")}>Start for free <ArrowRight size={16} aria-hidden /></Link>
                  <SmoothScrollLink href="#product" className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl px-2 text-sm font-semibold text-emerald-300 hover:text-emerald-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
                    See how it works <ArrowDown size={15} aria-hidden />
                  </SmoothScrollLink>
                </div>
              </div>
              <p className="mt-5 text-sm text-slate-400">Malaysia-first · MYR-ready · Works on desktop, tablet &amp; mobile</p>
            </div>

            <div className="relative min-w-0">
              {/* A quiet offset card behind the preview for depth; no transforms or animation. */}
              <div aria-hidden className="absolute -inset-3 top-6 hidden rounded-3xl bg-white/[0.06] sm:block" />
              <div className="relative"><DashboardPreview /></div>
            </div>
          </div>
        </section>

        <section aria-labelledby="features-title" className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-20">
          <SectionHeading id="features-title" eyebrow="Features" title="Everything you need to run your club" body="One workspace for the day-to-day of a martial arts club, from the first registration to the monthly accounts." />
          <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {features.map(({ icon: Icon, title, body }) => (
              <li key={title} className="rounded-2xl border border-border bg-white p-5">
                <span className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary"><Icon size={19} strokeWidth={1.75} aria-hidden /></span>
                <h3 className="mt-4 text-base font-bold tracking-[-0.01em]">{title}</h3>
                <p className="mt-1.5 text-sm leading-6 text-slate-600">{body}</p>
              </li>
            ))}
          </ul>
        </section>

        {/* Product showcase: the "See how it works" target. */}
        <section id="product" tabIndex={-1} aria-labelledby="product-title" className="scroll-mt-20 border-y border-border bg-background outline-none">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-20">
            <SectionHeading id="product-title" eyebrow="Product" title="Built for the way martial arts clubs actually work" />
            <div className="mt-12 space-y-16 lg:space-y-20">
              {showcase.map(({ id, icon: Icon, label, title, body, points, preview }, i) => (
                <article key={id} aria-labelledby={`showcase-${id}`} className="grid items-center gap-8 lg:grid-cols-2 lg:gap-14">
                  <div className={cn("min-w-0", i % 2 === 1 && "lg:order-2")}>
                    <p className="inline-flex items-center gap-2 text-sm font-semibold text-primary"><Icon size={16} strokeWidth={1.75} aria-hidden /> {label}</p>
                    <h3 id={`showcase-${id}`} className="mt-3 text-2xl font-bold leading-tight tracking-[-0.025em] sm:text-[1.75rem]">{title}</h3>
                    <p className="mt-3 text-[1.0625rem] leading-7 text-slate-600">{body}</p>
                    <ul className="mt-5 space-y-2.5">
                      {points.map((point) => (
                        <li key={point} className="flex gap-2.5 text-[0.9375rem] text-slate-700">
                          <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-primary/10 text-primary"><Check size={12} strokeWidth={2.5} aria-hidden /></span>
                          {point}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className={cn("min-w-0", i % 2 === 1 && "lg:order-1")}>{preview}</div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section aria-labelledby="audience-title" className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
          <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between md:gap-10">
            <h2 id="audience-title" className="shrink-0 text-xl! tracking-[-.02em]!">Built for martial arts clubs of all kinds</h2>
            <ul className="flex flex-wrap gap-2">
              {disciplines.map((d) => <li key={d} className="rounded-full border border-border bg-white px-3.5 py-1.5 text-sm font-medium text-slate-700">{d}</li>)}
            </ul>
          </div>
        </section>

        <section aria-labelledby="malaysia-title" className="border-t border-border">
          <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:py-20">
            <SectionHeading id="malaysia-title" eyebrow="Malaysia-first" title="Made for Malaysian clubs" body="Ranting is built around how clubs here run: ringgit, branches across states, and parents who reply on WhatsApp." />
            <ul className="grid gap-4 sm:grid-cols-2">
              {malaysia.map(({ icon: Icon, title, body }) => (
                <li key={title} className="flex gap-3.5 rounded-2xl border border-border bg-white p-4">
                  <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-muted text-foreground"><Icon size={17} strokeWidth={1.75} aria-hidden /></span>
                  <span className="min-w-0">
                    <span className="block text-[0.9375rem] font-semibold">{title}</span>
                    <span className="mt-0.5 block text-sm leading-6 text-slate-600">{body}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section aria-labelledby="cta-title" className="mx-auto max-w-6xl px-4 pb-16 sm:px-6 lg:pb-20">
          <div className="flex flex-col items-start justify-between gap-7 rounded-3xl bg-navy p-8 text-white sm:p-12 md:flex-row md:items-center">
            <div className="min-w-0">
              <h2 id="cta-title" className="text-2xl! tracking-[-.03em]! sm:text-3xl!">Run your club with less admin.</h2>
              <p className="mt-2 text-slate-300">Start managing your club with Ranting for free today.</p>
            </div>
            <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
              <Link href="/signup" className={cn(startOnNavy, "w-full sm:w-auto")}>Start for free <ArrowRight size={16} aria-hidden /></Link>
              <Link href="/login" className={cn(buttonVariants({ variant: "outline" }), "w-full border-white/30 bg-transparent text-white shadow-none hover:border-white/50 hover:bg-white/10 sm:w-auto")}>Log in</Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border bg-background">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 sm:px-6 md:flex-row md:items-end md:justify-between">
          <div className="max-w-sm">
            <Image src={assets.banner} alt="Ranting" className="h-auto w-28" />
            <p className="mt-3 text-sm leading-6 text-slate-600">Club management for martial arts clubs: branches, students, classes, fees and finances in one secure workspace.</p>
            <p className="mt-3 text-xs text-slate-500">© {new Date().getFullYear()} Ranting · Malaysia</p>
          </div>
          {/* Privacy and Terms links go here once those pages exist (no routes yet). */}
          <nav aria-label="Footer" className="flex flex-wrap gap-x-6 gap-y-2 text-sm font-semibold">
            <Link href="/login" className="text-slate-700 hover:text-foreground">Log in</Link>
            <Link href="/signup" className="text-primary hover:underline">Start for free</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
