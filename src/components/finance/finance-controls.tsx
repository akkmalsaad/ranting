"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Search, SlidersHorizontal, X } from "lucide-react";
import { BranchSelect, triggerClass, type BranchOption } from "@/components/finance/branch-select";
import { PeriodPicker } from "@/components/finance/period-picker";
import { Button } from "@/components/ui/button";
import { UNCATEGORISED, builtinCategories, type ClubCategories, type TransactionKind } from "@/lib/finance/values";
import { financeHref, periodChanges, type FinancePeriod } from "@/lib/finance/view";
import { cn } from "@/lib/utils";

type Query = Record<string, string>;

function Updating({ pending }: { pending: boolean }) {
  return pending ? <span role="status" className="inline-flex items-center gap-1 text-xs font-medium text-primary"><Loader2 size={12} aria-hidden className="animate-spin motion-reduce:animate-none" /> Updating…</span> : null;
}

/** Hidden copies of the current params so the no-JavaScript GET fallback keeps the other filters. */
function Keep({ query, omit }: { query: Query; omit: string[] }) {
  return <>{Object.entries(query).filter(([k]) => !omit.includes(k)).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}</>;
}

/**
 * Period and branch for the whole Finance page. A completed selection applies at once (the page
 * reloads in a transition with an "Updating…" status) and keeps the transaction-list filters,
 * returning to the first page. The server validates both and RLS scopes every query.
 */
export function FinanceControls({ base, query, period, today, selected, branches }: { base: string; query: Query; period: FinancePeriod; today: string; selected: string; branches: { id: string; name: string; archived_at: string | null }[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const go = (changes: Record<string, string | undefined>) => startTransition(() => router.push(financeHref(base, query, { ...changes, page: undefined }), { scroll: false }));
  const options = [{ value: "", label: "All branches" }, ...branches.map((b) => ({ value: b.id, label: `${b.name}${b.archived_at ? " (archived)" : ""}` }))];
  const branch = branches.find((b) => b.id === selected);
  return (
    <form action={base} aria-busy={pending} className="mb-6 rounded-2xl border border-border bg-white p-4 sm:px-5">
      <Keep query={query} omit={["branch", "period", "month", "date", "from", "to", "page"]} />
      <div className="grid gap-3 sm:grid-cols-[minmax(0,20rem)_minmax(0,17rem)]">
        <PeriodPicker key={JSON.stringify(period.params)} period={period} today={today} onChange={(params) => go(periodChanges(params))} />
        <BranchSelect key={selected} name="branch" label="Branch" options={options} defaultValue={selected} onValueChange={(value) => go({ branch: value || undefined })} />
      </div>
      <div className="mt-3 flex min-h-5 flex-wrap items-center justify-between gap-x-3 gap-y-1 border-t border-border pt-3 text-[0.8125rem] text-slate-500">
        <p>
          {/* On phones the period picker shows the range beneath its trigger. */}
          <span className="hidden sm:inline"><span className="font-semibold text-foreground">{period.range}</span>{" · "}</span>
          {branch ? `${branch.name}${branch.archived_at ? " (archived)" : ""}, excluding club-level records` : "All branches and club-level records"}
        </p>
        <Updating pending={pending} />
      </div>
      <noscript><button type="submit" className="mt-2 rounded-xl border border-border bg-white px-4 py-2 text-sm font-semibold">Apply</button></noscript>
    </form>
  );
}

/** Category choices for the list: grouped under Income and Expenses on the All tab. */
function categoryOptions(tab: string, categories: ClubCategories): BranchOption[] {
  const kinds: TransactionKind[] = tab === "income" || tab === "expense" ? [tab] : ["income", "expense"];
  return [
    { value: "", label: "All categories" },
    ...kinds.flatMap((kind) => {
      const group = tab ? undefined : kind === "income" ? "Income" : "Expenses";
      // Archived categories stay filterable so their history can still be found.
      const list = categories[kind].map((c) => ({ value: c.value, label: c.archived ? `${c.label} (archived)` : c.label }));
      return [...list, { value: UNCATEGORISED, label: "Uncategorised" }].map((c) => ({ value: `${kind}:${c.value}`, label: c.label, group }));
    }),
  ];
}

/**
 * Description search and category filter for the transaction list only (the overview and
 * breakdowns ignore them). Changing either returns to the first page. On small screens they sit in
 * a collapsible Filters panel.
 */
export function TransactionFilters({ base, query, tab, category, search, categories = builtinCategories }: { base: string; query: Query; tab: string; category: string; search: string; categories?: ClubCategories }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const active = (category ? 1 : 0) + (search ? 1 : 0);
  const [open, setOpen] = useState(active > 0);
  const [text, setText] = useState(search);
  const go = (changes: Record<string, string | undefined>) => startTransition(() => router.push(financeHref(base, query, { ...changes, page: undefined }), { scroll: false }));
  return (
    <div className="mb-4">
      <div className="flex items-center justify-between gap-3 md:hidden">
        <Button type="button" variant="outline" size="sm" aria-expanded={open} aria-controls="transaction-filters" onClick={() => setOpen((o) => !o)}>
          <SlidersHorizontal size={16} aria-hidden /> Filters{active ? ` (${active})` : ""}
        </Button>
        <Updating pending={pending} />
      </div>
      <form
        id="transaction-filters"
        role="search"
        action={base}
        aria-busy={pending}
        onSubmit={(event) => { event.preventDefault(); go({ q: text.trim() || undefined }); }}
        className={cn("mt-3 flex-col gap-2.5 md:mt-0 md:flex md:flex-row md:items-end", open ? "flex" : "hidden")}
      >
        <Keep query={query} omit={["q", "category", "page"]} />
        <div className="min-w-0 md:w-80">
          <label htmlFor="transaction-search" className="mb-2">Search descriptions</label>
          <div className="relative">
            <Search size={16} aria-hidden className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            {/* 16px text on phones stops iOS Safari zooming in; the native search clear button is hidden for ours. */}
            <input id="transaction-search" type="search" name="q" value={text} onChange={(e) => setText(e.target.value)} maxLength={80} placeholder="e.g. Hall rental" enterKeyHint="search" className={cn(triggerClass, "appearance-none pl-10 pr-10 text-base sm:text-sm [&::-webkit-search-cancel-button]:appearance-none")} />
            {text && <button type="button" aria-label="Clear search" onClick={() => { setText(""); if (search) go({ q: undefined }); }} className="absolute right-1.5 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-lg text-slate-500 hover:bg-muted focus-visible:outline-2 focus-visible:outline-primary"><X size={16} aria-hidden /></button>}
          </div>
        </div>
        <Button type="submit" variant="outline" className="shrink-0">Search</Button>
        <div className="min-w-0 md:w-72">
          <BranchSelect key={`${tab}:${category}`} name="category" label="Category" icon="category" options={categoryOptions(tab, categories)} defaultValue={category} onValueChange={(value) => go({ category: value || undefined })} />
        </div>
        <span className="hidden pb-3 md:inline"><Updating pending={pending} /></span>
      </form>
    </div>
  );
}
