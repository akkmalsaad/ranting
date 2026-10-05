"use client";
import { useEffect, useId, useRef, useState } from "react";
import { Info } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Small "i" button with an explanation: shown on hover and keyboard focus, toggled by tap/click,
 * closed with Escape or an outside tap. The text is the button's description (aria-describedby),
 * so screen readers read it with the button even when it isn't visible.
 */
export function InfoTip({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("pointerdown", onPointerDown); document.removeEventListener("keydown", onKey); };
  }, [open]);
  return (
    <span ref={root} className={cn("group relative inline-flex", className)} onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <button type="button" aria-label={label} aria-describedby={id} aria-expanded={open} onClick={() => setOpen((v) => !v)} onFocus={() => setOpen(true)} onBlur={() => setOpen(false)}
        className="grid size-6 place-items-center rounded-full text-slate-500 transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-primary">
        <Info size={14} aria-hidden />
      </button>
      <span id={id} role="tooltip" className={cn("absolute left-0 top-full z-30 mt-1.5 w-64 max-w-[calc(100vw-3rem)] rounded-xl bg-navy px-3 py-2 text-xs font-normal leading-5 text-white shadow-lg", open ? "block popover-in" : "hidden")}>
        {children}
      </span>
    </span>
  );
}
