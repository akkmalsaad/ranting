import Link from "next/link";
import { ArrowLeft } from "lucide-react";

/**
 * Page title, optional subtitle and actions, plus an optional back link above the title. Actions
 * sit on the right from sm up and stack below the text on phones.
 *
 * `actionsAlign="subtitle"` centres a single 44px action button on the subtitle line
 * ((44px − 24px line) / 2 = 10px below bottom alignment) so it reads as part of the header
 * rather than floating near the title. The header's own height is unchanged.
 */
export function PageHeader({ title, description, actions, actionsAlign = "bottom", back, badge }: { title: string; description?: React.ReactNode; actions?: React.ReactNode; actionsAlign?: "bottom" | "subtitle"; back?: { href: string; label: string }; badge?: React.ReactNode }) {
  return (
    <div className="mb-8">
      {back && <Link href={back.href} className="mb-4 inline-flex items-center gap-1.5 rounded-lg text-sm font-semibold text-slate-600 transition-colors hover:text-foreground"><ArrowLeft size={16} aria-hidden /> {back.label}</Link>}
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
        <div className="min-w-0 max-w-full break-words">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <h1 className="text-[1.75rem]! leading-tight tracking-[-0.03em]! sm:text-[2rem]!">{title}</h1>
            {badge}
          </div>
          {description && <p className="mt-2 max-w-2xl text-[0.9375rem] text-slate-600">{description}</p>}
        </div>
        {actions && <div className={`flex w-full min-w-0 max-w-full flex-wrap items-end gap-2.5 sm:w-auto ${actionsAlign === "subtitle" && description ? "sm:-mb-2.5" : ""}`}>{actions}</div>}
      </div>
    </div>
  );
}
