"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, LayoutDashboard, MapPin, Settings, Users, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { href: "", label: "Dashboard", icon: LayoutDashboard },
  { href: "/branches", label: "Branches", icon: MapPin },
  { href: "/students", label: "Students", icon: Users },
  { href: "/classes", label: "Classes", icon: CalendarDays, soon: true },
  { href: "/fees", label: "Fees", icon: Wallet, soon: true },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function ClubNav({ clubId }: { clubId: string }) {
  const pathname = usePathname();
  const base = `/clubs/${clubId}`;
  return (
    <nav aria-label="Club" className="-mx-4 overflow-x-auto px-4 lg:mx-0 lg:px-0">
      <ul className="flex gap-1 lg:flex-col">
        {items.map(({ href, label, icon: Icon, soon }) => {
          const target = base + href;
          const active = href ? pathname.startsWith(target) : pathname === base;
          return (
            <li key={label}>
              <Link href={target} aria-current={active ? "page" : undefined} className={cn("flex items-center gap-3 whitespace-nowrap rounded-xl border-l-4 px-3 py-2.5 text-sm font-medium text-slate-600 hover:bg-muted", active ? "border-primary bg-primary/10 font-semibold text-foreground" : "border-transparent")}>
                <Icon size={18} aria-hidden />
                {label}
                {soon && <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-slate-500">Soon</span>}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
