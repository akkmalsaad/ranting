"use client";
import { ChipContent, chipVariants } from "@/components/classes/calendar-entries";
import type { BranchTone } from "@/lib/branch-colors";
import { cn } from "@/lib/utils";

/**
 * A static Classes-calendar chip for the homepage previews: the app's own chip styles and content
 * (a client module, hence this small client component), without the button or popover.
 */
export function PreviewChip({ name, time, code, tone, look = "branch", completed, cancelled, unclosed }: {
  name: string;
  time: string;
  code: string;
  tone: BranchTone;
  look?: "branch" | "today" | "muted";
  completed?: boolean;
  cancelled?: boolean;
  /** Past but still scheduled: the amber "Not marked completed" dot. */
  unclosed?: boolean;
}) {
  return (
    <div className={cn(chipVariants({ look }), look !== "muted" && tone.chip, look === "today" && tone.ring)}>
      <ChipContent name={name} time={time} code={code} tone={tone} muted={look === "muted"} completed={completed} cancelled={cancelled} unclosed={unclosed} />
    </div>
  );
}
