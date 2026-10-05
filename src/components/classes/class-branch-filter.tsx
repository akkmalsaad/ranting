"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { BranchSelect } from "@/components/finance/branch-select";
import { classesHref, type ClassBranch } from "@/lib/classes-shared";

/**
 * Classes branch filter: applies on selection and keeps the visible month and selected day
 * (the table page resets). Without JavaScript it falls back to a GET form with Apply.
 * The server still validates the branch (branchScope) and RLS scopes every query.
 */
export function ClassBranchFilter({ base, month, date, selected, branches }: { base: string; month: string; date: string; selected: string; branches: ClassBranch[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  // "All branches" plus current branches; an archived branch only appears while it is the filter.
  const options = [{ value: "", label: "All branches" }, ...branches.filter((b) => !b.archived_at || b.id === selected).map((b) => ({ value: b.id, label: `${b.name}${b.archived_at ? " (archived)" : ""}` }))];
  return (
    <form action={base} className="relative w-full sm:w-[260px]" aria-busy={pending}>
      <input type="hidden" name={date ? "date" : "month"} value={date || month} />
      <BranchSelect key={selected} name="branch" label="Branch" options={options} defaultValue={selected} onValueChange={(value) => startTransition(() => router.push(classesHref(base, { month: date ? undefined : month, date, branch: value }), { scroll: false }))} />
      {pending && <span role="status" className="absolute -bottom-5 right-0 inline-flex items-center gap-1 text-xs font-medium text-primary"><Loader2 size={12} aria-hidden className="animate-spin motion-reduce:animate-none" /> Updating…</span>}
      <noscript><button type="submit" className="mt-2 rounded-xl border border-border bg-white px-4 py-2 text-sm font-semibold">Apply</button></noscript>
    </form>
  );
}
