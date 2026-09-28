import Link from "next/link";
import { cn } from "@/lib/utils";

/** Link-based filter tabs; the active tab is marked with aria-current and an underline, not colour alone. */
export function ViewTabs({ label, tabs }: { label: string; tabs: { href: string; label: string; active: boolean }[] }) {
  return (
    <nav aria-label={label} className="mb-6 flex gap-1 overflow-x-auto border-b border-border">
      {tabs.map((t) => (
        <Link key={t.href} href={t.href} aria-current={t.active ? "page" : undefined} className={cn("-mb-px whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium", t.active ? "border-primary font-semibold text-foreground" : "border-transparent text-slate-600 hover:text-foreground")}>
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
