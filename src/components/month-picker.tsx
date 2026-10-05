"use client";
import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight, Inbox } from "lucide-react";
import { triggerClass } from "@/components/finance/branch-select";
import { MONTH_NAMES } from "@/lib/calendar";
import { cn } from "@/lib/utils";

const subscribe = () => () => {};
const pad = (month: number) => String(month).padStart(2, "0");
/** Months are plain "YYYY-MM" strings built from numbers: no Date objects, so nothing can shift. */
const key = (year: number, month: number) => `${year}-${pad(month)}`;
const longLabel = (value: string) => `${MONTH_NAMES[Number(value.slice(5, 7)) - 1]} ${value.slice(0, 4)}`;

type Special = { value: string; label: string; description?: string };

/**
 * Compact month picker: a select-style trigger opening a popover with ‹ year › and a 12-month
 * grid. The arrows only change the year shown; choosing a month (or the separate `special` option,
 * e.g. "All outstanding") calls `onChange` and closes. Phones get a full-width sheet with large
 * targets. Keyboard: arrows move between months, Enter/Space choose, Escape closes and returns
 * focus to the trigger. Before hydration it renders a native select (`fallback`) so the
 * surrounding GET form still works.
 */
export function MonthPicker({ label, name, value, today, onChange, special, fallback, minYear, maxYear }: {
  label: string;
  /** Field name for the pre-hydration native select. */
  name: string;
  /** "YYYY-MM", or `special.value`. */
  value: string;
  /** Malaysia date (YYYY-MM-DD) from the server, for "This month". */
  today: string;
  onChange: (value: string) => void;
  special?: Special;
  fallback: { value: string; label: string }[];
  minYear: number;
  maxYear: number;
}) {
  const id = useId();
  const hydrated = useSyncExternalStore(subscribe, () => true, () => false);
  const current = today.slice(0, 7);
  const isSpecial = !!special && value === special.value;
  const selectedYear = isSpecial ? Number(current.slice(0, 4)) : Number(value.slice(0, 4));
  const [open, setOpen] = useState(false);
  const [year, setYear] = useState(selectedYear);
  const [focusMonth, setFocusMonth] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  // Close on outside click/tap; the applied value is unchanged.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => { if (!rootRef.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  // Keep keyboard focus on the intended month after opening, arrow keys or a year change.
  useEffect(() => {
    if (open && focusMonth) gridRef.current?.querySelector<HTMLButtonElement>(`[data-month="${focusMonth}"]`)?.focus();
  }, [open, focusMonth, year]);

  function show() {
    const start = isSpecial ? current : value;
    setYear(Number(start.slice(0, 4)));
    setFocusMonth(start);
    setOpen(true);
  }
  function close(returnFocus = true) {
    setOpen(false);
    if (returnFocus) requestAnimationFrame(() => triggerRef.current?.focus());
  }
  function choose(next: string) {
    close();
    if (next !== value) onChange(next);
  }
  function moveYear(step: number) {
    setFocusMonth(null);
    setYear((y) => Math.min(maxYear, Math.max(minYear, y + step)));
  }
  /** Arrow keys move by one month (left/right) or one row (up/down), crossing years at the edges. */
  function onMonthKey(event: React.KeyboardEvent, month: number) {
    const columns = gridRef.current ? getComputedStyle(gridRef.current).gridTemplateColumns.split(" ").length : 4;
    const step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -columns, ArrowDown: columns }[event.key];
    if (!step) return;
    event.preventDefault();
    const index = year * 12 + (month - 1) + step;
    const nextYear = Math.floor(index / 12);
    if (nextYear < minYear || nextYear > maxYear) return;
    setYear(nextYear);
    setFocusMonth(key(nextYear, (index % 12) + 1));
  }

  // Roving tab stop in the grid: the month being navigated to, else the selected or current month
  // when it's in the year shown, else January.
  const tabTarget = [focusMonth, isSpecial ? null : value, current].find((m) => m?.startsWith(`${year}-`)) ?? key(year, 1);
  const display = isSpecial ? special!.label : `${longLabel(value)}${value === current ? " (this month)" : ""}`;
  const icon = <CalendarDays size={16} aria-hidden className="pointer-events-none shrink-0 text-primary" />;
  const chevron = <ChevronDown size={16} aria-hidden className={cn("pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 transition-transform duration-150", open && "rotate-180 text-primary")} />;
  const yearButton = "grid size-10 shrink-0 place-items-center rounded-lg text-slate-600 transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-35 focus-visible:outline-2 focus-visible:outline-primary";

  if (!hydrated) {
    return (
      <div className="min-w-0">
        <label htmlFor={id} className="mb-2">{label}</label>
        <div className="relative">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2">{icon}</span>
          {/* Global select styles are unlayered, so the overrides below use `!`. */}
          <select id={id} name={name} defaultValue={value} className={cn(triggerClass, "appearance-none !rounded-xl !py-0 !pl-9 !pr-10 !text-sm focus-visible:!outline-none")}>
            {fallback.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          {chevron}
        </div>
      </div>
    );
  }

  return (
    <div ref={rootRef} className="min-w-0">
      <label id={`${id}-label`} htmlFor={id} className="mb-2">{label}</label>
      <div className="relative">
        <input type="hidden" name={name} value={value} />
        <button
          ref={triggerRef}
          id={id}
          type="button"
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-controls={open ? `${id}-panel` : undefined}
          onClick={() => (open ? close(false) : show())}
          onKeyDown={(event) => { if (event.key === "ArrowDown" && !open) { event.preventDefault(); show(); } }}
          className={cn(triggerClass, open && "border-primary ring-4 ring-primary/15")}
        >
          {icon}
          <span className="min-w-0 flex-1 truncate">{display}</span>
        </button>
        {chevron}

        {open && <>
          {/* Phones: dim the page behind the sheet; tapping it closes. */}
          <button type="button" tabIndex={-1} aria-hidden onClick={() => close(false)} className="fixed inset-0 z-40 cursor-default bg-navy/30 sm:hidden" />
          <div
            id={`${id}-panel`}
            role="dialog"
            aria-label={`Choose ${label.toLowerCase()}`}
            onKeyDown={(event) => { if (event.key === "Escape") { event.preventDefault(); close(); } }}
            className={cn(
              "popover-in z-50 rounded-2xl border border-border bg-white p-3 shadow-[0_16px_40px_-12px_#071e3033,0_2px_6px_#071e3010]",
              // Phones: a full-width sheet near the bottom of the screen. sm and up: a dropdown.
              "fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] sm:absolute sm:inset-x-auto sm:bottom-auto sm:left-0 sm:top-[calc(100%+0.375rem)] sm:w-[21rem]",
            )}
          >
            <div className="mb-2 flex items-center justify-between gap-2">
              <button type="button" onClick={() => moveYear(-1)} disabled={year <= minYear} aria-label={`Previous year, ${year - 1}`} className={yearButton}><ChevronLeft size={18} aria-hidden /></button>
              <p aria-live="polite" className="text-[0.9375rem] font-semibold tabular-nums">{year}</p>
              <button type="button" onClick={() => moveYear(1)} disabled={year >= maxYear} aria-label={`Next year, ${year + 1}`} className={yearButton}><ChevronRight size={18} aria-hidden /></button>
            </div>

            {/* Keyed by year so a year change fades the months in. */}
            <div key={year} ref={gridRef} role="group" aria-label={`Months of ${year}`} className="popover-in grid grid-cols-4 gap-1.5 max-[359px]:grid-cols-3">
              {MONTH_NAMES.map((name, i) => {
                const month = key(year, i + 1);
                const selected = !isSpecial && month === value;
                const isCurrent = month === current;
                return (
                  <button
                    key={name}
                    type="button"
                    data-month={month}
                    aria-pressed={selected}
                    aria-label={`${name} ${year}${isCurrent ? ", this month" : ""}`}
                    tabIndex={month === tabTarget ? 0 : -1}
                    onClick={() => choose(month)}
                    onKeyDown={(event) => onMonthKey(event, i + 1)}
                    className={cn(
                      "relative flex min-h-11 flex-col items-center justify-center rounded-xl text-sm transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
                      selected ? "bg-primary font-semibold text-white" : "text-foreground hover:bg-muted",
                      isCurrent && !selected && "font-semibold ring-1 ring-inset ring-primary/35",
                    )}
                  >
                    {name.slice(0, 3)}
                    {/* "This month": a quiet dot, never louder than the selection. */}
                    {isCurrent && <span aria-hidden className={cn("absolute bottom-1.5 size-1 rounded-full", selected ? "bg-white/80" : "bg-primary")} />}
                  </button>
                );
              })}
            </div>

            <div className="mt-2 flex justify-end">
              <button type="button" onClick={() => choose(current)} className="min-h-9 rounded-lg px-3 text-sm font-semibold text-primary transition-colors hover:bg-primary/5 focus-visible:outline-2 focus-visible:outline-primary">This month</button>
            </div>

            {special && (
              <div className="mt-2 border-t border-border pt-2">
                <button
                  type="button"
                  aria-pressed={isSpecial}
                  onClick={() => choose(special.value)}
                  className={cn(
                    "flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors focus-visible:outline-2 focus-visible:outline-primary",
                    isSpecial ? "bg-primary/[0.07] text-primary" : "hover:bg-muted",
                  )}
                >
                  <Inbox size={16} aria-hidden className={cn("shrink-0", isSpecial ? "text-primary" : "text-slate-500")} />
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold">{special.label}</span>
                    {special.description && <span className={cn("block text-xs", isSpecial ? "text-primary/80" : "text-slate-500")}>{special.description}</span>}
                  </span>
                </button>
              </div>
            )}
          </div>
        </>}
      </div>
    </div>
  );
}
