import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const tones = {
  neutral: "bg-slate-100 text-slate-700 ring-slate-200/70",
  success: "bg-emerald-50 text-emerald-800 ring-emerald-200/60",
  warning: "bg-amber-50 text-amber-800 ring-amber-200/70",
  danger: "bg-red-50 text-red-800 ring-red-200/60",
  info: "bg-sky-50 text-sky-800 ring-sky-200/60",
  brand: "bg-primary/10 text-primary ring-primary/15",
} as const;
export type BadgeTone = keyof typeof tones;

/** Status pill: soft tint plus an icon and text, so meaning never relies on colour alone. */
export function Badge({ tone = "neutral", icon: Icon, children, className }: { tone?: BadgeTone; icon?: LucideIcon; children: React.ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex w-fit items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold leading-5 ring-1 ring-inset", tones[tone], className)}>
      {Icon && <Icon size={13} strokeWidth={2.25} aria-hidden />}
      {children}
    </span>
  );
}
