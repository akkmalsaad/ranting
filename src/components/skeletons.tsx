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

const Tabs = ({ count }: { count: number }) => <div className="mb-6 flex gap-2 border-b border-border pb-3">{Array.from({ length: count }, (_, i) => <Block key={i} className="h-6 w-20" />)}</div>;

export function DashboardSkeleton() {
  return (
    <Loading label="Loading dashboard…">
      <HeaderSkeleton />
      <div className="grid gap-4 sm:grid-cols-2">
        {[0, 1].map((i) => <div key={i} className="panel flex items-center gap-4"><Block className="size-12 rounded-2xl" /><div className="space-y-2"><Block className="h-8 w-16" /><Block className="h-4 w-28" /></div></div>)}
      </div>
      <div className="panel mt-6 space-y-3"><Block className="h-5 w-40" /><Block className="h-4 w-64 max-w-full" /><Block className="h-11 w-36" /></div>
    </Loading>
  );
}

export function BranchesSkeleton() {
  return (
    <Loading label="Loading branches…">
      <HeaderSkeleton action />
      <Tabs count={2} />
      <ul className="grid gap-4 md:grid-cols-2">
        {[0, 1, 2, 3].map((i) => <li key={i} className="panel flex items-start gap-4"><Block className="size-11 rounded-2xl" /><div className="flex-1 space-y-2"><Block className="h-5 w-40" /><Block className="h-4 w-full" /></div></li>)}
      </ul>
    </Loading>
  );
}

export function StudentsSkeleton() {
  return (
    <Loading label="Loading students…">
      <HeaderSkeleton action />
      <Tabs count={4} />
      <div className="mb-6 grid gap-3 sm:grid-cols-[1fr_220px_auto]"><Block className="h-12" /><Block className="h-12" /><Block className="h-12 w-28" /></div>
      <ul className="overflow-hidden rounded-[1.25rem] border border-border bg-white">
        {Array.from({ length: 6 }, (_, i) => (
          <li key={i} className="grid gap-2 border-b border-border p-4 last:border-b-0 sm:grid-cols-[1.4fr_1fr_1fr_auto] sm:items-center sm:gap-4 sm:px-6">
            <div className="space-y-2"><Block className="h-4 w-44" /><Block className="h-3 w-24" /></div>
            <div className="space-y-2"><Block className="h-4 w-32" /><Block className="h-3 w-24" /></div>
            <Block className="h-4 w-28" />
            <Block className="h-6 w-20 rounded-full" />
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
        {[0, 1, 2, 3].map((i) => <div key={i} className="space-y-2"><Block className="h-4 w-28" /><Block className="h-12" /></div>)}
        <Block className="h-11 w-36" />
      </div>
    </Loading>
  );
}
