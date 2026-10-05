"use client";
import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { BranchSelect } from "@/components/finance/branch-select";

/**
 * Compact dashboard branch selector: applies on selection (no Apply button) and shows progress
 * while the overview reloads. Without JavaScript it falls back to a GET form with Apply.
 * The server still validates the branch (branchScope) and RLS scopes every query.
 */
export function DashboardBranchFilter({ base, selected, branches, branchCount }: { base: string; selected: string; branches: { id: string; name: string; archived_at: string | null }[]; branchCount: number | null }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const options = [{ value: "", label: "All branches" }, ...branches.map((b) => ({ value: b.id, label: `${b.name}${b.archived_at ? " (archived)" : ""}` }))];
  return (
    <form action={base} className="w-full sm:w-[280px]" aria-busy={pending}>
      <BranchSelect name="branch" label="Branch" options={options} defaultValue={selected} onValueChange={(value) => startTransition(() => router.push(value ? `${base}?branch=${value}` : base, { scroll: false }))} />
      <div className="mt-1.5 flex min-h-5 items-center justify-between gap-3 text-xs text-slate-500">
        {branchCount === null ? <span /> : <Link href={`${base}/branches`} className="hover:text-primary hover:underline">{branchCount} {branchCount === 1 ? "branch" : "branches"}</Link>}
        {pending && <span role="status" className="inline-flex items-center gap-1 font-medium text-primary"><Loader2 size={12} aria-hidden className="animate-spin motion-reduce:animate-none" /> Updating…</span>}
      </div>
      <noscript><button type="submit" className="mt-2 rounded-xl border border-border bg-white px-4 py-2 text-sm font-semibold">Apply</button></noscript>
    </form>
  );
}
