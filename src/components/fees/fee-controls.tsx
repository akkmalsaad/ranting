"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { BranchSelect } from "@/components/finance/branch-select";
import { MonthPicker } from "@/components/month-picker";
import { billingMonthLabel, feesHref, shiftMonth } from "@/lib/fees/values";

const OUTSTANDING = "outstanding";

/**
 * Billing period (a month, or All outstanding across every month) and branch for the Fees page.
 * A selection applies at once (with an "Updating…" status) and keeps the status filter and search,
 * returning to the first page. The server validates both; RLS scopes every query.
 */
export function FeeControls({ base, query, month, outstanding, today, selected, branches }: { base: string; query: Record<string, string>; month: string; outstanding: boolean; today: string; selected: string; branches: { id: string; name: string; archived_at: string | null }[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const go = (changes: Record<string, string | undefined>) => startTransition(() => router.push(feesHref(base, query, { ...changes, page: undefined }), { scroll: false }));
  const current = today.slice(0, 7);
  // Pre-hydration (no-JavaScript) list only: three months ahead to three years back, plus the
  // selected month if it's outside that window. The month picker itself browses by year.
  const months = Array.from({ length: 40 }, (_, i) => shiftMonth(current, 3 - i));
  if (month && !months.includes(month)) months.push(month);
  months.sort((a, b) => b.localeCompare(a));
  const periodOptions = [{ value: OUTSTANDING, label: "All outstanding (every month)" }, ...months.map((m) => ({ value: m, label: `${billingMonthLabel(m)}${m === current ? " (this month)" : ""}` }))];
  const thisYear = Number(current.slice(0, 4));
  const branchOptions = [{ value: "", label: "All branches" }, ...branches.map((b) => ({ value: b.id, label: `${b.name}${b.archived_at ? " (archived)" : ""}` }))];
  return (
    <form action={base} aria-busy={pending} className="relative mb-6 rounded-2xl border border-border bg-white p-4 sm:px-5">
      <div className="grid gap-3 sm:grid-cols-[minmax(0,16rem)_minmax(0,17rem)]">
        {/* Same URL as the old dropdown: All outstanding → scope=outstanding; a month → month=YYYY-MM
            (omitted for the current month, the page default). */}
        <MonthPicker key={outstanding ? OUTSTANDING : month} name="period" label="Billing period" value={outstanding ? OUTSTANDING : month} today={today} fallback={periodOptions}
          special={{ value: OUTSTANDING, label: "All outstanding", description: "Across every billing period" }}
          minYear={Math.min(Number(month.slice(0, 4)) || thisYear, thisYear - 10)} maxYear={Math.max(Number(month.slice(0, 4)) || thisYear, thisYear + 1)}
          onChange={(value) => go(value === OUTSTANDING ? { scope: OUTSTANDING, month: undefined } : { scope: undefined, month: value === current ? undefined : value })} />
        <BranchSelect key={selected} name="branch" label="Branch" options={branchOptions} defaultValue={selected} onValueChange={(value) => go({ branch: value || undefined })} />
      </div>
      <div className="absolute right-4 top-4 flex justify-end sm:right-5">
        {pending && <span role="status" className="inline-flex items-center gap-1 text-xs font-medium text-primary"><Loader2 size={12} aria-hidden className="animate-spin motion-reduce:animate-none" /> Updating…</span>}
      </div>
      {/* Without JavaScript the native selects submit with Apply; "period" is mapped by the page. */}
      <noscript><button type="submit" className="mt-3 rounded-xl border border-border bg-white px-4 py-2 text-sm font-semibold">Apply</button></noscript>
    </form>
  );
}
