import { useId } from "react";
import { cn } from "@/lib/utils";

/**
 * A titled group of form fields: a full-width, left-aligned heading (a hairline divider above every
 * section after the first) and a field grid that is one column on phones and two from `sm`. Fields
 * that should span the row use `sm:col-span-2`; `columns` overrides the grid (e.g. 40/60).
 * A labelled group (role="group"), not a <fieldset>/<legend>, so the heading lays out like any block.
 */
export function FormSection({ title, columns = "sm:grid-cols-2", children }: { title: string; columns?: string; children: React.ReactNode }) {
  const id = useId();
  return (
    <section role="group" aria-labelledby={id} className="border-t border-border pt-6 text-left first:border-t-0 first:pt-0">
      <h3 id={id} className="text-[0.9375rem] font-bold leading-6 tracking-[-0.01em] text-foreground">{title}</h3>
      <div className={cn("mt-4 grid grid-cols-1 gap-x-5 gap-y-5", columns)}>{children}</div>
    </section>
  );
}
