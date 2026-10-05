import type { BranchTone } from "@/lib/branch-colors";
import { cn } from "@/lib/utils";

/**
 * A branch's short code ("BA") as a small badge in the branch colour: the light tint behind the
 * colour's dark shade, 11px medium, 4px radius. It never shrinks, so neighbouring text truncates
 * first. Decorative (aria-hidden): the branch's full name is always given nearby (the chip's
 * aria-label, the popover, the legend or a Branch row).
 */
export function BranchCodeBadge({ code, tone, className }: { code: string; tone: BranchTone; className?: string }) {
  return <span aria-hidden className={cn("inline-block shrink-0 rounded px-1 text-[11px] font-medium leading-4", tone.badge, className)}>{code}</span>;
}
