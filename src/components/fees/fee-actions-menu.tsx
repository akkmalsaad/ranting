"use client";
import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { MoreHorizontal } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * "⋯" menu for a fee's secondary actions (Edit, Void) in the details panel. Menu-button pattern:
 * opens on click/Enter/Space/ArrowDown with focus on the first item; arrows, Home/End move; Escape
 * or Tab closes (Escape returns focus to the button). Items are links to the panel's existing views.
 */
export function FeeActionsMenu({ label, items }: { label: string; items: { label: string; href: string; danger?: boolean }[] }) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const links = useRef<(HTMLAnchorElement | null)[]>([]);
  useEffect(() => {
    if (!open) return;
    links.current[0]?.focus();
    const onPointerDown = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);
  if (items.length === 0) return null;

  const onMenuKeyDown = (event: React.KeyboardEvent) => {
    const list = links.current.filter((l): l is HTMLAnchorElement => !!l);
    const index = list.indexOf(document.activeElement as HTMLAnchorElement);
    const focus = (i: number) => { event.preventDefault(); list[(i + list.length) % list.length]?.focus(); };
    if (event.key === "ArrowDown") focus(index + 1);
    else if (event.key === "ArrowUp") focus(index - 1);
    else if (event.key === "Home") focus(0);
    else if (event.key === "End") focus(list.length - 1);
    else if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); setOpen(false); button.current?.focus(); }
    else if (event.key === "Tab") setOpen(false);
  };

  return (
    <div ref={root} className="relative">
      <button ref={button} type="button" aria-label={label} aria-haspopup="menu" aria-expanded={open} aria-controls={open ? id : undefined}
        onClick={() => setOpen((v) => !v)} onKeyDown={(e) => { if (e.key === "ArrowDown") { e.preventDefault(); setOpen(true); } }}
        className={cn(buttonVariants({ variant: "outline" }), "px-3")}>
        <MoreHorizontal size={18} aria-hidden />
      </button>
      {open && (
        <div id={id} role="menu" aria-label={label} onKeyDown={onMenuKeyDown} className="popover-in absolute bottom-full right-0 z-30 mb-2 w-44 rounded-xl border border-border bg-white p-1.5 shadow-[0_16px_40px_-12px_#071e3033,0_2px_6px_#071e3010]">
          {items.map((item, i) => (
            <Link key={item.href} ref={(el) => { links.current[i] = el; }} href={item.href} scroll={false} role="menuitem" tabIndex={-1} onClick={() => setOpen(false)}
              className={cn("block rounded-lg px-3 py-2.5 text-sm font-semibold outline-none hover:bg-muted focus-visible:bg-muted", item.danger ? "text-red-700" : "text-foreground")}>
              {item.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
