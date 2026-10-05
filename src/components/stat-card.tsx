import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { InfoTip } from "@/components/info-tip";
import { cn } from "@/lib/utils";

const tones = {
  default: { card: "border-border bg-white", hover: "hover:border-slate-300", label: "text-slate-600", note: "text-slate-500", icon: "bg-muted text-foreground" },
  positive: { card: "border-border bg-white", hover: "hover:border-slate-300", label: "text-slate-600", note: "text-slate-500", icon: "bg-primary/10 text-primary" },
  warning: { card: "border-border bg-white", hover: "hover:border-slate-300", label: "text-slate-600", note: "text-slate-500", icon: "bg-amber-50 text-amber-700" },
  featured: { card: "border-navy bg-navy text-white", hover: "hover:bg-navy-hover", label: "text-white/70", note: "text-white/60", icon: "bg-white/10 text-white" },
} as const;

/**
 * Summary figure: label and icon, the value, then a short note. With `href` the whole card is a
 * link. `positive` tints the icon with the brand emerald, `warning` with amber; `featured` is the
 * one navy card for the key figure in a row. `info` adds an "i" tooltip beside the label (not with
 * `href`, which makes the whole card a link).
 */
export function StatCard({ label, value, note, href, icon: Icon, tone = "default", info }: { label: string; value: string; note: string; href?: string; icon: LucideIcon; tone?: keyof typeof tones; info?: React.ReactNode }) {
  const t = tones[tone];
  const body = <>
    <span className="flex items-center justify-between gap-3">
      <span className="inline-flex min-w-0 items-center gap-1">
        <span className={cn("text-[0.8125rem] font-medium", t.label)}>{label}</span>
        {info && !href && <InfoTip label={`About ${label}`}>{info}</InfoTip>}
      </span>
      <span className={cn("grid size-8 shrink-0 place-items-center rounded-lg", t.icon)}><Icon size={16} strokeWidth={1.75} aria-hidden /></span>
    </span>
    <span className="mt-4 break-words text-[1.75rem] font-semibold leading-tight tracking-[-0.025em] tabular-nums">{value}</span>
    <span className={cn("mt-1.5 text-[0.8125rem]", t.note)}>{note}</span>
  </>;
  const className = cn("flex min-w-0 flex-col rounded-2xl border p-5", t.card);
  return href
    ? <Link href={href} className={cn(className, "transition-colors duration-200", t.hover)}>{body}</Link>
    : <div className={className}>{body}</div>;
}
