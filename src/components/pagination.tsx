import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const step = cn(buttonVariants({ variant: "outline", size: "sm" }), "gap-1 px-2.5");

/**
 * Previous · "Page x of y" · Next. Each side is a link only when that page exists; callers keep
 * their own href logic (and `scroll={false}` where the page relies on it).
 */
export function Pagination({ page, pages, previousHref, nextHref, scroll, label = "Pagination" }: { page: number; pages: number; previousHref?: string; nextHref?: string; scroll?: boolean; label?: string }) {
  return (
    <nav aria-label={label} className="mt-5 flex items-center justify-between gap-3 text-sm">
      {previousHref ? <Link href={previousHref} scroll={scroll} className={step}><ChevronLeft size={16} aria-hidden /> Previous</Link> : <span />}
      <span className="text-slate-500 tabular-nums">Page <span className="font-semibold text-foreground">{Math.min(page, pages)}</span> of {pages}</span>
      {nextHref ? <Link href={nextHref} scroll={scroll} className={step}>Next <ChevronRight size={16} aria-hidden /></Link> : <span />}
    </nav>
  );
}
