import Image, { type StaticImageData } from "next/image";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Empty or no-results state: an existing illustration (or an icon), a title, a short explanation
 * and an optional action. `compact` drops the card and padding for use inside another section.
 */
export function EmptyState({ image, icon: Icon, title, description, action, compact = false, className }: { image?: StaticImageData; icon?: LucideIcon; title: string; description?: React.ReactNode; action?: React.ReactNode; compact?: boolean; className?: string }) {
  return (
    <section className={cn("flex flex-col items-center text-center", compact ? "px-4 py-8" : "rounded-2xl border border-border bg-white px-6 py-12 sm:py-14", className)}>
      {image ? <Image src={image} alt="" className="h-auto w-32 sm:w-36" />
        : Icon ? <span className="grid size-12 place-items-center rounded-2xl bg-muted text-slate-600"><Icon size={22} strokeWidth={1.75} aria-hidden /></span>
        : null}
      <h2 className={cn("text-base! font-semibold!", (image || Icon) && "mt-5")}>{title}</h2>
      {description && <p className="mt-1.5 max-w-sm text-sm leading-6 text-slate-600">{description}</p>}
      {action && <div className="mt-5 flex flex-wrap justify-center gap-2.5">{action}</div>}
    </section>
  );
}
