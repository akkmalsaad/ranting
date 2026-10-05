"use client";
import Link from "next/link";
import { useFormState } from "@/components/action-form";
import { BranchSelect } from "@/components/finance/branch-select";

export type BeltLevelOption = { id: string; name: string; color: string; stripe_color?: string | null; archived_at: string | null };

/**
 * Optional "Current belt / level" selector for staff forms (Add/Edit student, approval).
 * Lists active levels in progression order with their colours, plus the student's current level if
 * it has since been archived (kept, but not offered to others). With no levels configured it
 * submits nothing, so an existing assignment is never cleared, and points to Settings.
 */
export function BeltLevelField({ name, levels, defaultValue, settingsHref }: { name: string; levels: BeltLevelOption[]; defaultValue?: string | null; settingsHref?: string }) {
  const state = useFormState();
  const error = state.fieldErrors?.[name]?.[0];
  const current = defaultValue ?? "";
  const available = levels.filter((level) => !level.archived_at || level.id === current);

  if (!available.length) {
    return (
      <div>
        <p className="text-sm font-semibold">Current belt / level</p>
        <p className="mt-2 text-sm text-slate-500">
          No belt levels yet. {settingsHref ? <>Add them in <Link href={`${settingsHref}?section=belt-levels`} className="font-semibold text-primary hover:underline">Settings → Belt levels</Link>.</> : "Add them in Settings → Belt levels."}
        </p>
      </div>
    );
  }

  const options = [
    { value: "", label: "Not assigned" },
    ...available.map((level) => ({ value: level.id, label: level.archived_at ? `${level.name} (archived)` : level.name, color: level.color, stripe: level.stripe_color })),
  ];
  return (
    <div>
      <BranchSelect name={name} label="Current belt / level" icon="belt" options={options} defaultValue={state.values?.[name] ?? current} />
      {error && <p className="mt-1.5 text-sm font-medium text-red-700">{error}</p>}
    </div>
  );
}
