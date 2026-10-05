"use client";
import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, X } from "lucide-react";
import { useFormState } from "@/components/action-form";
import { triggerClass } from "@/components/finance/branch-select";
import { MONTH_NAMES, WEEKDAYS_MONDAY_FIRST, daysInMonth, longDate, mondayIndex, shiftDays, toDDMMYYYY, ymd } from "@/lib/calendar";
import { cn } from "@/lib/utils";

const MIN_DATE = "1900-01-02"; // matches the validation rule (after 1 January 1900)
const MIN_YEAR = 1900;
const subscribe = () => () => {};

/**
 * Date-of-birth picker for the public registration form: jump straight to a year and month, then
 * pick a day. Optional (starts empty, can be cleared); future dates are disabled using `today`
 * (Malaysia date from the server). Submits a plain YYYY-MM-DD value under `name`, like the native
 * date input it replaces, and shows errors/refilled values from the surrounding ActionForm.
 */
export function DateOfBirthField({ name, today, hint = "Optional" }: { name: string; today: string; hint?: string }) {
  const id = useId();
  const hydrated = useSyncExternalStore(subscribe, () => true, () => false);
  const state = useFormState();
  const error = state.fieldErrors?.[name]?.[0];
  const [value, setValue] = useState(state.values?.[name] ?? "");
  const [open, setOpen] = useState(false);
  const todayYear = Number(today.slice(0, 4));
  const [view, setView] = useState(() => ({ year: todayYear, month: Number(today.slice(5, 7)) }));
  const [focusDate, setFocusDate] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const yearRef = useRef<HTMLSelectElement>(null);
  const justOpened = useRef(false);
  const describedBy = [`${id}-hint`, error && `${id}-error`].filter(Boolean).join(" ");

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => { if (!rootRef.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  // Focus the selected day (or a day reached with arrow keys); when opening without a date,
  // start once at the year selector so parents can jump straight to the birth year.
  useEffect(() => {
    if (!open) return;
    if (focusDate) panelRef.current?.querySelector<HTMLButtonElement>(`[data-date="${focusDate}"]`)?.focus();
    else if (justOpened.current) yearRef.current?.focus();
    justOpened.current = false;
  }, [open, focusDate, view]);

  function show() {
    const base = value || today;
    setView({ year: Number(base.slice(0, 4)), month: Number(base.slice(5, 7)) });
    setFocusDate(value || null);
    justOpened.current = true;
    setOpen(true);
  }
  function close(returnFocus = true) {
    setOpen(false);
    if (returnFocus) requestAnimationFrame(() => triggerRef.current?.focus());
  }
  function choose(date: string) { setValue(date); close(); }
  function clear() { setValue(""); close(); }
  function moveMonth(step: number) {
    setFocusDate(null);
    setView((v) => { const index = v.year * 12 + (v.month - 1) + step; return { year: Math.floor(index / 12), month: (index % 12) + 1 }; });
  }
  function onDayKey(event: React.KeyboardEvent, date: string) {
    const steps: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
    if (!(event.key in steps)) return;
    event.preventDefault();
    const target = shiftDays(date, steps[event.key]);
    if (target > today || target < MIN_DATE) return;
    setView({ year: Number(target.slice(0, 4)), month: Number(target.slice(5, 7)) });
    setFocusDate(target);
  }

  const viewMonth = ymd(view.year, view.month, 1).slice(0, 7);
  const atEarliest = view.year <= MIN_YEAR && view.month === 1;
  const atLatest = viewMonth >= today.slice(0, 7);
  const years = Array.from({ length: todayYear - MIN_YEAR + 1 }, (_, i) => todayYear - i);
  const tabDate = [focusDate, value, today].find((d) => d?.startsWith(viewMonth)) ?? ymd(view.year, view.month, 1);
  const smallSelect = "!min-h-0 !w-auto !rounded-lg !px-2 !py-1.5 !text-sm font-semibold focus-visible:!outline-none focus-visible:ring-2 focus-visible:ring-primary/30";

  return (
    <div ref={rootRef} className="min-w-0">
      <label htmlFor={id}>Date of birth</label>
      <div className="relative mt-2">
        {hydrated ? (
          <>
            <input type="hidden" name={name} value={value} />
            <button
              ref={triggerRef}
              id={id}
              type="button"
              aria-haspopup="dialog"
              aria-expanded={open}
              aria-controls={`${id}-panel`}
              aria-invalid={!!error}
              aria-describedby={describedBy}
              onClick={() => (open ? close(false) : show())}
              onKeyDown={(event) => {
                if (event.key === "ArrowDown" && !open) { event.preventDefault(); show(); }
                if (event.key === "Escape" && open) { event.preventDefault(); close(); }
              }}
              className={cn(triggerClass, "pr-10", open && "border-primary ring-4 ring-primary/15", error && "border-red-700")}
            >
              <CalendarDays size={16} aria-hidden className="pointer-events-none shrink-0 text-primary" />
              <span className={cn("min-w-0 flex-1 truncate", !value && "font-normal text-slate-500")}>{value ? toDDMMYYYY(value) : "Select date (DD/MM/YYYY)"}</span>
              {value && <span className="sr-only">, {longDate(value)}</span>}
            </button>
            {value && (
              <button type="button" onClick={() => setValue("")} aria-label="Clear date of birth" className="absolute right-2 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-lg text-slate-500 hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-primary">
                <X size={16} aria-hidden />
              </button>
            )}
            {open && (
              <div
                ref={panelRef}
                id={`${id}-panel`}
                role="dialog"
                aria-label="Choose date of birth"
                onKeyDown={(event) => { if (event.key === "Escape") { event.preventDefault(); close(); } }}
                className="absolute left-0 top-[calc(100%+0.375rem)] z-30 w-[19.5rem] max-w-[calc(100vw-2rem)] rounded-xl border border-border bg-white p-3 shadow-[0_16px_40px_-12px_#071e3033,0_2px_6px_#071e3010]"
              >
                <div className="mb-2 flex items-center justify-between gap-1">
                  <button type="button" onClick={() => moveMonth(-1)} disabled={atEarliest} aria-label="Previous month" className="grid size-9 shrink-0 place-items-center rounded-lg text-slate-600 hover:bg-muted disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-primary"><ChevronLeft size={18} aria-hidden /></button>
                  <div className="flex min-w-0 items-center gap-1">
                    <select ref={yearRef} aria-label="Year" value={view.year} onChange={(e) => { setFocusDate(null); const year = Number(e.target.value); setView((v) => ({ year, month: year === todayYear ? Math.min(v.month, Number(today.slice(5, 7))) : v.month })); }} className={smallSelect}>
                      {years.map((y) => <option key={y} value={y}>{y}</option>)}
                    </select>
                    <select aria-label="Month" value={view.month} onChange={(e) => { setFocusDate(null); setView((v) => ({ ...v, month: Number(e.target.value) })); }} className={smallSelect}>
                      {MONTH_NAMES.map((month, i) => <option key={month} value={i + 1} disabled={ymd(view.year, i + 1, 1).slice(0, 7) > today.slice(0, 7)}>{month}</option>)}
                    </select>
                  </div>
                  <button type="button" onClick={() => moveMonth(1)} disabled={atLatest} aria-label="Next month" className="grid size-9 shrink-0 place-items-center rounded-lg text-slate-600 hover:bg-muted disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-primary"><ChevronRight size={18} aria-hidden /></button>
                </div>
                <div role="group" aria-label={`${MONTH_NAMES[view.month - 1]} ${view.year}. Use arrow keys to move between days.`}>
                  <div aria-hidden className="grid grid-cols-7 text-center text-xs font-semibold text-slate-500">
                    {WEEKDAYS_MONDAY_FIRST.map((d) => <span key={d} className="py-1.5">{d}</span>)}
                  </div>
                  <div className="grid grid-cols-7 gap-0.5">
                    {Array.from({ length: mondayIndex(view.year, view.month, 1) }, (_, i) => <span key={`blank-${i}`} aria-hidden />)}
                    {Array.from({ length: daysInMonth(view.year, view.month) }, (_, i) => {
                      const date = ymd(view.year, view.month, i + 1);
                      const selected = date === value;
                      return (
                        <button
                          key={date}
                          type="button"
                          data-date={date}
                          disabled={date > today || date < MIN_DATE}
                          aria-pressed={selected}
                          aria-label={longDate(date)}
                          tabIndex={date === tabDate ? 0 : -1}
                          onClick={() => choose(date)}
                          onKeyDown={(event) => onDayKey(event, date)}
                          className={cn(
                            "grid h-9 place-items-center rounded-lg text-sm tabular-nums transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary disabled:cursor-not-allowed disabled:text-slate-300",
                            selected ? "bg-primary font-semibold text-white" : "text-foreground hover:bg-muted",
                          )}
                        >
                          {i + 1}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between border-t border-border pt-3 text-sm">
                  <span className="text-xs text-slate-500">Choose the year first, then the month and day.</span>
                  <button type="button" onClick={clear} disabled={!value} className="rounded-lg px-2 py-1 font-semibold text-slate-600 hover:bg-muted disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-primary">Clear</button>
                </div>
              </div>
            )}
          </>
        ) : (
          <input id={id} type="date" name={name} defaultValue={value} min={MIN_DATE} max={today} aria-invalid={!!error} aria-describedby={describedBy} className={cn(triggerClass, "!pr-3")} />
        )}
      </div>
      <p id={`${id}-hint`} className="mt-1.5 text-xs text-slate-500">{hint}</p>
      {error && <p id={`${id}-error`} className="mt-1.5 text-sm font-medium text-red-700">{error}</p>}
    </div>
  );
}
