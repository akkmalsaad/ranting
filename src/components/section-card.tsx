import Link from "next/link";
import { cn } from "@/lib/utils";

/** White content section with a titled header row (optional badge and action). Avoid nesting cards inside it. */
export function SectionCard({ id, title, badge, description, action, children, className }: {
  id: string; title: string; badge?: React.ReactNode; description?: string; action?: React.ReactNode; children: React.ReactNode; className?: string;
}) {
  return (
    <section aria-labelledby={id} className={cn("min-w-0 rounded-2xl border border-border bg-white", className)}>
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 px-5 pt-5 sm:px-6">
        <div className="min-w-0">
          <h2 id={id} className="flex items-center gap-2 text-[1.0625rem]! font-semibold! tracking-[-0.015em]!">{title}{badge}</h2>
          {description && <p className="mt-0.5 text-[0.8125rem] text-slate-500">{description}</p>}
        </div>
        {action}
      </div>
      <div className="px-5 pb-2 pt-2 sm:px-6">{children}</div>
    </section>
  );
}

/** Header action link for a SectionCard ("View all …"). */
export function SectionLink({ href, children }: { href: string; children: React.ReactNode }) {
  return <Link href={href} className="text-sm font-semibold text-primary hover:underline">{children}</Link>;
}

/** Error or empty message inside a SectionCard. */
export function SectionMessage({ alert, children }: { alert?: boolean; children: React.ReactNode }) {
  return <p role={alert ? "alert" : undefined} className="py-6 text-sm text-slate-600">{children}</p>;
}
