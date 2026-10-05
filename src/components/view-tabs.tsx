"use client";
import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Link-based filter tabs as a segmented control: the active tab is a raised white pill (the
 * sidebar's active language) and carries aria-current plus a heavier weight, not colour alone.
 * Tabs wrap onto a second row on narrow screens rather than overflowing the page.
 *
 * A plain click updates the list in place, like the period and branch filters: the page keeps
 * its scroll position and current content (no loading skeleton) while the new list loads, the
 * clicked tab is highlighted at once, and "Updating…" shows until it arrives. The hrefs carry
 * every other filter and the search, and still work as ordinary links (new tab, no JavaScript).
 */
export function ViewTabs({ label, tabs, className }: { label: string; tabs: { href: string; label: string; active: boolean }[]; className?: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [target, setTarget] = useState<string | null>(null);
  const highlighted = pending && target ? target : tabs.find((t) => t.active)?.href;

  return (
    <nav aria-label={label} aria-busy={pending} className={cn("mb-6 flex max-w-full flex-wrap items-center gap-x-3 gap-y-2", className)}>
      <div className="inline-flex max-w-full flex-wrap gap-1 rounded-xl bg-[#e8eef0] p-1">
        {tabs.map((t) => {
          const on = t.href === highlighted;
          return (
            <Link
              key={t.href}
              href={t.href}
              prefetch={false}
              scroll={false}
              aria-current={t.active ? "page" : undefined}
              onClick={(event) => {
                if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
                event.preventDefault();
                if (t.active && !pending) return;
                setTarget(t.href);
                startTransition(() => router.push(t.href, { scroll: false }));
              }}
              className={cn(
                "inline-flex min-h-9 items-center whitespace-nowrap rounded-lg px-3.5 text-sm transition-[color,background-color,box-shadow] duration-200 focus-visible:outline-offset-2",
                on ? "bg-white font-semibold text-foreground shadow-[0_1px_2px_#071e301f,0_1px_1px_#071e300a]" : "font-medium text-slate-600 hover:bg-white/60 hover:text-foreground",
              )}
            >
              {t.label}
            </Link>
          );
        })}
      </div>
      {pending && <span role="status" className="inline-flex items-center gap-1 text-xs font-medium text-primary"><Loader2 size={12} aria-hidden className="animate-spin motion-reduce:animate-none" /> Updating…</span>}
    </nav>
  );
}
