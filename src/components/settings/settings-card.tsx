import { cn } from "@/lib/utils";

/**
 * One settings card: title, optional one-line description, a single action on the right and a
 * short read-only summary below. Settings are reviewed here and edited in a dialog or sub-view.
 */
export function SettingsCard({ id, title, description, action, children, className }: { id: string; title: string; description?: string; action?: React.ReactNode; children?: React.ReactNode; className?: string }) {
  return (
    <section aria-labelledby={id} className={cn("rounded-2xl border border-border bg-white p-5 sm:p-6", className)}>
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
        <div className="min-w-0 flex-1">
          <h2 id={id}>{title}</h2>
          {description && <p className="mt-0.5 text-[0.8125rem] text-slate-500">{description}</p>}
        </div>
        {action && <div className="flex shrink-0 flex-wrap gap-2">{action}</div>}
      </div>
      {children && <div className="mt-4">{children}</div>}
    </section>
  );
}

/** Label/value rows inside a settings card. */
export function SettingsFacts({ items }: { items: [label: string, value: React.ReactNode][] }) {
  return (
    <dl className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
      {items.map(([label, value]) => (
        <div key={label} className="min-w-0">
          <dt className="text-[0.8125rem] text-slate-500">{label}</dt>
          <dd className="mt-0.5 break-words font-medium">{value ?? <span className="font-normal text-slate-400">Not set</span>}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Quiet note shown when a setting can't be changed yet (e.g. awaiting a database update). */
export function SettingsNote({ children }: { children: React.ReactNode }) {
  return <p className="mt-4 rounded-xl bg-slate-50 px-4 py-3 text-[0.8125rem] leading-5 text-slate-600 ring-1 ring-inset ring-border">{children}</p>;
}
