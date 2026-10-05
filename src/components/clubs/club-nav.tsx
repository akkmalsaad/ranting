"use client";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, LayoutDashboard, MapPin, Receipt, Settings, Users, Wallet, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type Item = { href: string; label: string; icon: LucideIcon };

// Grouped: overview · people and schedule · money · configuration.
const groups: Item[][] = [
  [{ href: "", label: "Dashboard", icon: LayoutDashboard }],
  [
    { href: "/branches", label: "Branches", icon: MapPin },
    { href: "/students", label: "Students", icon: Users },
    { href: "/classes", label: "Classes", icon: CalendarDays },
  ],
  [
    { href: "/fees", label: "Fees", icon: Receipt },
    { href: "/finances", label: "Finance", icon: Wallet },
  ],
  [{ href: "/settings", label: "Settings", icon: Settings }],
];

/**
 * Club navigation for the navy sidebar and mobile drawer.
 *
 * One white pill sits behind the highlighted item and slides between items with a CSS transform
 * transition, so a second click mid-slide retargets smoothly from wherever the pill is. The pill
 * moves as soon as a link is clicked (optimistic) while `aria-current` follows the real route.
 * Before hydration the highlighted link paints its own white background instead, so there's no
 * flash; once the pill is placed the list is marked `data-ready` and that fallback switches off.
 */
export function ClubNav({ clubId }: { clubId: string }) {
  const pathname = usePathname();
  const base = `/clubs/${clubId}`;
  const [pending, setPending] = useState<{ target: string; from: string } | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const pillRef = useRef<HTMLSpanElement>(null);
  const placeRef = useRef<(animate: boolean) => void>(() => {});

  const isCurrent = (target: string) => (target === base ? pathname === base : pathname === target || pathname.startsWith(`${target}/`));
  const currentTarget = groups.flat().map((i) => base + i.href).find(isCurrent) ?? null;
  // A clicked link stays highlighted until the route changes; then the route decides again.
  const highlighted = pending && pending.from === pathname ? pending.target : currentTarget;

  useLayoutEffect(() => {
    const list = listRef.current;
    const pill = pillRef.current;
    if (!list || !pill) return;
    placeRef.current = (animate) => {
      const item = highlighted ? list.querySelector<HTMLElement>(`[data-nav-target="${CSS.escape(highlighted)}"]`) : null;
      if (!item || !item.offsetHeight) { pill.style.opacity = "0"; return; }
      if (!animate) pill.style.transition = "none";
      pill.style.transform = `translateY(${item.getBoundingClientRect().top - list.getBoundingClientRect().top}px)`;
      pill.style.height = `${item.offsetHeight}px`;
      pill.style.opacity = "1";
      if (!animate) { void pill.offsetHeight; pill.style.transition = ""; }
    };
    placeRef.current(list.dataset.ready === "true");
    list.dataset.ready = "true";
  }, [highlighted]);

  // Re-place without animating when the list's size changes, e.g. the closed drawer
  // (display: none, nothing measurable) opening, or a viewport resize.
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    let size = `${list.offsetWidth}x${list.offsetHeight}`;
    const observer = new ResizeObserver(() => {
      const next = `${list.offsetWidth}x${list.offsetHeight}`;
      if (next === size) return;
      size = next;
      placeRef.current(false);
    });
    observer.observe(list);
    return () => observer.disconnect();
  }, []);

  return (
    <nav aria-label="Club">
      <div ref={listRef} className="group/nav relative">
        <span
          ref={pillRef}
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 rounded-full bg-white opacity-0 shadow-[0_1px_2px_rgb(0_0_0/0.18),0_6px_16px_-6px_rgb(0_0_0/0.35)] transition-[transform,opacity] duration-[280ms] ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none"
        />
        {groups.map((group, index) => (
          <ul key={index} className={cn("relative space-y-1", index > 0 && "mt-5 border-t border-white/[0.08] pt-5")}>
            {group.map(({ href, label, icon: Icon }) => {
              const target = base + href;
              const on = highlighted === target;
              return (
                <li key={label}>
                  <Link
                    href={target}
                    data-nav-target={target}
                    aria-current={target === currentTarget ? "page" : undefined}
                    onClick={(e) => {
                      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
                      setPending({ target, from: pathname });
                    }}
                    className={cn(
                      "relative flex min-h-11 items-center gap-3 rounded-full px-4 text-[0.9375rem] transition-colors duration-200",
                      on
                        ? "bg-white font-semibold text-navy group-data-[ready=true]/nav:bg-transparent"
                        : "font-medium text-white/70 hover:bg-white/[0.06] hover:text-white",
                    )}
                  >
                    <Icon size={18} strokeWidth={1.75} aria-hidden className="shrink-0" />
                    {label}
                  </Link>
                </li>
              );
            })}
          </ul>
        ))}
      </div>
    </nav>
  );
}
