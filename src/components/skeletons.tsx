import { cn } from "@/lib/utils";

// Loading placeholders for route-level loading.tsx files. They render instantly on navigation
// (and are what Next.js prefetches for dynamic routes) while the page's data streams in.

function Block({ className }: { className?: string }) {
  return <div aria-hidden className={cn("animate-pulse rounded-xl bg-muted motion-reduce:animate-none", className)} />;
}

function Loading({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div role="status" aria-live="polite">
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}

function HeaderSkeleton({ action = false }: { action?: boolean }) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div className="space-y-3"><Block className="h-9 w-56" /><Block className="h-4 w-72 max-w-full" /></div>
      {action && <Block className="h-11 w-36" />}
    </div>
  );
}

const Tabs = ({ count }: { count: number }) => <div className="mb-6 inline-flex max-w-full flex-wrap gap-1 rounded-xl bg-[#e8eef0] p-1">{Array.from({ length: count }, (_, i) => <span key={i} className="grid h-9 w-20 place-items-center"><Block className="h-3.5 w-14 bg-white/70" /></span>)}</div>;
const Toolbar = ({ widths }: { widths: string[] }) => <div className="mb-6 flex flex-wrap gap-3 rounded-2xl border border-border bg-white p-4 sm:px-5">{widths.map((w, i) => <div key={i} className={cn("space-y-2", w)}><Block className="h-4 w-20" /><Block className="h-11" /></div>)}</div>;
const Stats = ({ count }: { count: number }) => <div className={cn("mb-8 grid gap-4 sm:grid-cols-2", count === 3 ? "sm:grid-cols-3" : "xl:grid-cols-4")}>{Array.from({ length: count }, (_, i) => <div key={i} className="rounded-2xl border border-border bg-white p-5"><div className="flex items-center justify-between"><Block className="h-4 w-24" /><Block className="size-8 rounded-lg" /></div><Block className="mt-4 h-8 w-28" /><Block className="mt-2 h-3 w-20" /></div>)}</div>;

export function DashboardSkeleton() {
  return (
    <Loading label="Loading dashboard…">
      <HeaderSkeleton action />
      <div className="mb-8 flex flex-wrap gap-2.5"><Block className="h-11 w-36" /><Block className="h-11 w-32" /><Block className="h-11 w-32" /></div>
      <Block className="mb-3 h-5 w-36" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => <div key={i} className="rounded-2xl border border-border bg-white p-5"><div className="flex items-center justify-between"><Block className="h-4 w-24" /><Block className="size-8 rounded-lg" /></div><Block className="mt-4 h-8 w-28" /><Block className="mt-2 h-3 w-20" /></div>)}
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        {[0, 1].map((i) => (
          <div key={i} className="rounded-2xl border border-border bg-white p-5 sm:p-6">
            <Block className="h-5 w-44" />
            <div className="mt-4 space-y-4">{[0, 1, 2].map((j) => <div key={j} className="flex items-center gap-3"><Block className="size-9 rounded-full" /><div className="flex-1 space-y-2"><Block className="h-4 w-40" /><Block className="h-3 w-56 max-w-full" /></div></div>)}</div>
          </div>
        ))}
      </div>
    </Loading>
  );
}

export function BranchesSkeleton() {
  return (
    <Loading label="Loading branches…">
      <HeaderSkeleton action />
      <Tabs count={2} />
      <ul className="overflow-hidden rounded-2xl border border-border bg-white">
        {[0, 1, 2, 3].map((i) => <li key={i} className="grid gap-2 border-b border-border p-4 last:border-b-0 sm:grid-cols-[1.2fr_1.4fr_auto_1fr_auto] sm:items-center sm:gap-4 sm:px-5"><Block className="h-4 w-36" /><Block className="h-4 w-48" /><Block className="h-6 w-10 rounded-full" /><Block className="h-4 w-32" /><Block className="h-9 w-20" /></li>)}
      </ul>
    </Loading>
  );
}

export function StudentsSkeleton() {
  return (
    <Loading label="Loading students…">
      <HeaderSkeleton action />
      <Tabs count={4} />
      <div className="mb-6 grid gap-2.5 sm:grid-cols-[1fr_13rem_auto]"><Block className="h-11" /><Block className="h-11" /><Block className="h-11 w-24" /></div>
      <ul className="overflow-hidden rounded-2xl border border-border bg-white">
        {Array.from({ length: 6 }, (_, i) => (
          <li key={i} className="grid gap-2 border-b border-border p-4 last:border-b-0 sm:grid-cols-[1.4fr_1fr_1fr_auto] sm:items-center sm:gap-4 sm:px-6">
            <div className="flex items-center gap-3"><Block className="size-9 shrink-0 rounded-full" /><div className="space-y-2"><Block className="h-4 w-44" /><Block className="h-3 w-24" /></div></div>
            <div className="space-y-2"><Block className="h-4 w-32" /><Block className="h-3 w-24" /></div>
            <Block className="h-4 w-28" />
            <Block className="h-6 w-20 rounded-full" />
          </li>
        ))}
      </ul>
    </Loading>
  );
}

export function FinanceSkeleton() {
  return (
    <Loading label="Loading finance…">
      <HeaderSkeleton action />
      <Toolbar widths={["w-full sm:w-80", "w-full sm:w-64"]} />
      <Stats count={3} />
      <div className="grid gap-6 lg:grid-cols-2">
        {[0, 1].map((i) => <div key={i} className="panel space-y-4"><Block className="h-5 w-44" />{[0, 1, 2].map((j) => <div key={j} className="space-y-2"><Block className="h-4 w-full" /><Block className="h-2 w-2/3 rounded-full" /></div>)}</div>)}
      </div>
    </Loading>
  );
}

export function FeesSkeleton() {
  return (
    <Loading label="Loading fees…">
      <HeaderSkeleton action />
      <Toolbar widths={["w-full sm:w-72", "w-full sm:w-64"]} />
      <Block className="mb-3 h-4 w-64" />
      <Stats count={4} />
      <Tabs count={6} />
      <ul className="overflow-hidden rounded-2xl border border-border bg-white">
        {Array.from({ length: 6 }, (_, i) => (
          <li key={i} className="grid gap-2 border-b border-border p-4 last:border-b-0 sm:grid-cols-[1.2fr_1.4fr_1fr_auto] sm:items-center sm:gap-4 sm:px-6">
            <Block className="h-4 w-40" />
            <div className="space-y-2"><Block className="h-4 w-44" /><Block className="h-3 w-28" /></div>
            <Block className="h-4 w-24" />
            <Block className="h-6 w-20 rounded-full" />
          </li>
        ))}
      </ul>
    </Loading>
  );
}

export function ClassesSkeleton() {
  return (
    <Loading label="Loading classes…">
      <HeaderSkeleton action />
      {/* Calendar: toolbar, weekday row and a five-week month grid. */}
      <div className="overflow-hidden rounded-2xl border border-border bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4 sm:px-6">
          <Block className="h-7 w-40" />
          <div className="flex gap-2"><Block className="h-10 w-48" /><Block className="h-10 w-20" /><Block className="h-10 w-[5.25rem]" /></div>
        </div>
        <div className="grid grid-cols-7 border-b border-border bg-slate-50/80">{Array.from({ length: 7 }, (_, i) => <div key={i} className="px-1 py-2 md:px-3"><Block className="mx-auto h-3 w-8 md:mx-0" /></div>)}</div>
        {Array.from({ length: 5 }, (_, week) => (
          <div key={week} className="grid grid-cols-7 border-b border-border last:border-b-0">
            {Array.from({ length: 7 }, (_, day) => (
              <div key={day} className="min-h-16 border-r border-border p-1 last:border-r-0 md:min-h-[8.25rem] md:p-2">
                <Block className="mx-auto size-7 rounded-full md:mx-0" />
                {(week + day) % 3 === 0 && <Block className="mt-2 hidden h-8 w-full md:block" />}
              </div>
            ))}
          </div>
        ))}
      </div>
      {/* Class table */}
      <div className="mb-4 mt-10 space-y-2"><Block className="h-6 w-56" /><Block className="h-4 w-32" /></div>
      <ul className="overflow-hidden rounded-2xl border border-border bg-white">
        {Array.from({ length: 4 }, (_, i) => (
          <li key={i} className="grid gap-2 border-b border-border p-4 last:border-b-0 sm:grid-cols-[1.4fr_1fr_1fr_1fr_auto] sm:items-center sm:gap-4 sm:px-5">
            <Block className="h-4 w-40" />
            <Block className="h-4 w-28" />
            <Block className="h-4 w-28" />
            <Block className="h-4 w-32" />
            <Block className="h-6 w-24 rounded-full" />
          </li>
        ))}
      </ul>
    </Loading>
  );
}

export function FormSkeleton({ label }: { label: string }) {
  return (
    <Loading label={label}>
      <HeaderSkeleton />
      <div className="panel max-w-3xl space-y-5">
        {[0, 1, 2, 3].map((i) => <div key={i} className="space-y-2"><Block className="h-4 w-28" /><Block className="h-11" /></div>)}
        <Block className="h-11 w-36" />
      </div>
    </Loading>
  );
}
