import Image from "next/image";
import { CalendarDays, LayoutDashboard, MapPin, Settings, Users, Wallet } from "lucide-react";
import { assets } from "@/lib/assets";

const items = [
  { label: "Dashboard", icon: LayoutDashboard },
  { label: "Branches", icon: MapPin },
  { label: "Students", icon: Users },
  { label: "Classes", icon: CalendarDays },
  { label: "Fees", icon: Wallet },
  { label: "Settings", icon: Settings },
];

/**
 * Visual preview of the club workspace shown behind the onboarding modal before a club exists.
 * Purely decorative: hidden from assistive tech and inert, since there's nothing to navigate to yet.
 */
export function OnboardingShell() {
  return (
    <div aria-hidden inert className="min-h-screen select-none lg:grid lg:grid-cols-[260px_1fr]">
      <aside className="border-b border-border bg-white px-4 pb-3 pt-4 lg:h-screen lg:border-b-0 lg:border-r lg:p-6">
        <Image src={assets.banner} alt="" className="h-auto w-32 lg:w-36" priority />
        <div className="my-4 flex items-center gap-3 lg:my-8">
          <Image src={assets.club} alt="" className="size-10 rounded-xl object-cover" />
          <div><p className="font-semibold">Your club</p><p className="text-xs text-slate-500">Martial arts</p></div>
        </div>
        <ul className="flex gap-1 overflow-hidden lg:flex-col">
          {items.map(({ label, icon: Icon }, i) => (
            <li key={label} className={`flex items-center gap-3 whitespace-nowrap rounded-xl border-l-4 px-3 py-2.5 text-sm font-medium ${i === 0 ? "border-primary bg-primary/10 text-foreground" : "border-transparent text-slate-600"}`}><Icon size={18} />{label}</li>
          ))}
        </ul>
      </aside>
      <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-10 lg:py-10">
        <h1>Welcome to Ranting</h1>
        <p className="mt-2 text-slate-600">Your club overview will appear here.</p>
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {["Active branches", "Active students"].map((label) => <div key={label} className="panel"><span className="block text-3xl font-bold">0</span><span className="text-sm text-slate-600">{label}</span></div>)}
        </div>
        <section className="panel mt-6 flex items-center gap-6"><Image src={assets.emptyBranches} alt="" className="h-auto w-32" /><div><h2>Add your first branch</h2><p className="mt-2 text-sm text-slate-600">Branches are where your club trains.</p></div></section>
      </main>
    </div>
  );
}
