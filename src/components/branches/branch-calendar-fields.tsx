"use client";
import { useEffect, useId, useRef, useState } from "react";
import { Check } from "lucide-react";
import { Input } from "@/components/ui/input";
import { FormSection } from "@/components/form-section";
import { useFormState } from "@/components/action-form";
import { ChipContent, chipVariants } from "@/components/classes/calendar-entries";
import { BRANCH_COLOR_KEYS, BRANCH_TONES, resolveBranchColors, suggestShortCode, type BranchColorKey } from "@/lib/branch-colors";
import type { BranchOption } from "@/lib/finance/queries";
import { cn } from "@/lib/utils";

/**
 * Calendar appearance section of the branch form: a short code (shown on calendar chips) with a live chip
 * preview, and a colour from the fixed palette. Colours used by the club's other current branches
 * are marked "In use" but can still be chosen. Only rendered once the database has the columns
 * (`palette` from the page); otherwise neither field is submitted and saving leaves them alone.
 */
export function BranchCalendarFields({ branchId, initialName, palette }: { branchId?: string; initialName?: string; palette: BranchOption[] }) {
  const id = useId();
  const state = useFormState();
  const self = palette.find((b) => b.id === branchId);
  const others = palette.filter((b) => b.id !== branchId);
  const effective = resolveBranchColors(palette);
  const takenBy = new Map<BranchColorKey, string[]>();
  for (const b of others) {
    const key = effective.get(b.id);
    if (key && !b.archived_at) takenBy.set(key, [...(takenBy.get(key) ?? []), b.name]);
  }
  // New branch: the first colour no current branch uses. Existing: its saved (or fallback) colour.
  const defaultColor = (self && effective.get(self.id)) ?? BRANCH_COLOR_KEYS.find((key) => !takenBy.has(key)) ?? BRANCH_COLOR_KEYS[0];

  // Values refill after a failed submission (ActionForm echoes them back), like the other fields.
  const initialCode = state.values?.short_code ?? self?.short_code ?? "";
  const initialColor = (state.values?.color as BranchColorKey | undefined) ?? defaultColor;
  const [code, setCode] = useState(initialCode);
  const [color, setColor] = useState<BranchColorKey>(initialColor);
  const [seen, setSeen] = useState({ initialCode, initialColor });
  if (seen.initialCode !== initialCode || seen.initialColor !== initialColor) {
    setSeen({ initialCode, initialColor });
    setCode(initialCode);
    setColor(initialColor);
  }

  // Follow the Branch name field (elsewhere in the same form) for the suggested code.
  const codeInput = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(state.values?.name ?? initialName ?? "");
  useEffect(() => {
    const form = codeInput.current?.form;
    if (!form) return;
    const onInput = (event: Event) => { const t = event.target as HTMLInputElement; if (t.name === "name") setName(t.value); };
    form.addEventListener("input", onInput);
    return () => form.removeEventListener("input", onInput);
  }, []);

  const suggestion = suggestShortCode(name);
  const duplicate = code.length >= 2 ? others.find((b) => b.short_code === code) : undefined;
  const error = state.fieldErrors?.short_code?.[0];
  const colorError = state.fieldErrors?.color?.[0];
  const tone = BRANCH_TONES[color];

  return (
    // Row 1: short code (~40%) and the live preview; row 2: colour, full width. One column on phones.
    <FormSection title="Calendar appearance" columns="sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
      <div className="min-w-0">
        <label htmlFor={`${id}-code`}>Short code</label>
        <div className="mt-1.5 flex items-center gap-2">
          <Input
            ref={codeInput}
            id={`${id}-code`}
            name="short_code"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4))}
            maxLength={4}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            placeholder={suggestion || "e.g. BA"}
            aria-invalid={!!error || !!duplicate}
            aria-describedby={[error && `${id}-code-error`, duplicate && `${id}-code-dup`, `${id}-code-hint`].filter(Boolean).join(" ")}
            className="w-32 font-semibold uppercase tracking-wide placeholder:font-normal placeholder:normal-case placeholder:tracking-normal"
          />
          {!code && suggestion && <button type="button" onClick={() => setCode(suggestion)} className="shrink-0 rounded-lg px-2 py-1.5 text-sm font-semibold text-primary hover:bg-primary/10 focus-visible:outline-2 focus-visible:outline-primary">Use {suggestion}</button>}
        </div>
        <p id={`${id}-code-hint`} className="mt-1.5 text-xs text-slate-500">Optional. 2–4 letters or numbers, unique in your club. Shown on calendar classes.</p>
        {duplicate && !error && <p id={`${id}-code-dup`} className="mt-1.5 text-sm font-medium text-amber-800" aria-live="polite">Already used by {duplicate.name}.</p>}
        {error && <p id={`${id}-code-error`} className="mt-1.5 text-sm font-medium text-red-700">{error}</p>}
      </div>

      {/* Live preview: the same chip styles as the Classes calendar. */}
      <div className="min-w-0">
        <p className="text-sm font-semibold">Calendar preview</p>
        <div className="mt-1.5 flex min-h-11 items-center rounded-xl border border-dashed border-border bg-slate-50/70 px-3 py-2.5">
          <div className="w-48 max-w-full" role="img" aria-label={`Example class chip in ${tone.label.toLowerCase()}${code.length >= 2 ? `, labelled ${code}` : ""}`}>
            <div className={cn(chipVariants({ look: "branch" }), tone.chip, "pointer-events-none cursor-default")}>
              <ChipContent name="Example class" time="9–11 AM" code={code.length >= 2 ? code : null} tone={tone} />
            </div>
          </div>
        </div>
        <p className="mt-1.5 text-xs text-slate-500">How this branch&apos;s classes look on the Classes calendar.</p>
      </div>

      <fieldset className="min-w-0 sm:col-span-2" aria-describedby={colorError ? `${id}-color-error` : undefined}>
        <legend className="mb-2 p-0 text-sm font-semibold">Colour</legend>
        <div className="flex flex-wrap gap-x-2 gap-y-3">
          {BRANCH_COLOR_KEYS.map((key) => {
            const t = BRANCH_TONES[key];
            const usedBy = takenBy.get(key);
            const checked = color === key;
            return (
              // The global `label` rule (display: block, semibold) beats utilities, so the layout and
              // weights live on the inner elements. Each option is a fixed-width tile, so the row
              // starts at the left edge and wraps on narrow screens.
              <label key={key} title={usedBy ? `Used by ${usedBy.join(", ")}` : undefined} className="w-[4.25rem] cursor-pointer rounded-lg py-1">
                <input type="radio" name="color" value={key} checked={checked} onChange={() => setColor(key)} aria-describedby={usedBy ? `${id}-${key}-used` : undefined} className="peer sr-only" />
                <span aria-hidden className={cn("mx-auto grid size-9 place-items-center rounded-full ring-offset-2 transition-shadow peer-checked:ring-2 peer-checked:ring-navy peer-focus-visible:outline-2 peer-focus-visible:outline-offset-4 peer-focus-visible:outline-primary", t.dot)}>
                  {checked && <Check size={16} strokeWidth={3} className="text-white" />}
                </span>
                <span className="mt-1 block text-center text-xs font-medium text-slate-700">{t.label}</span>
                <span id={`${id}-${key}-used`} className={cn("mt-0.5 block text-center text-[11px] font-normal leading-4 text-slate-600", !usedBy && "invisible")}>{usedBy ? <>In use<span className="sr-only"> by {usedBy.join(", ")}</span></> : "Free"}</span>
              </label>
            );
          })}
        </div>
        <p className="mt-1.5 text-xs text-slate-500">Colours marked &ldquo;In use&rdquo; belong to another branch but can still be chosen.</p>
        {colorError && <p id={`${id}-color-error`} className="mt-1.5 text-sm font-medium text-red-700">{colorError}</p>}
      </fieldset>
    </FormSection>
  );
}
