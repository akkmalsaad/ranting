"use client";
import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { CalendarDays, Check, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { triggerClass } from "@/components/finance/branch-select";
import { MONTH_NAMES, WEEKDAYS_MONDAY_FIRST, daysInMonth, mondayIndex, shiftDays, ymd } from "@/lib/calendar";
import { formatRange, type FinancePeriod, type PeriodKind } from "@/lib/finance/view";
import { cn } from "@/lib/utils";

type View = { year: number; month: number }; // month 1–12
type Picker = "month" | "day" | "range";
const MIN_YEAR = 1900;
// "This month" is the default view, so its URL has no period params.
const PRESETS: { kind: PeriodKind; label: string; params: Record<string, string> }[] = [
  { kind: "this-month", label: "This month", params: {} },
  { kind: "last-month", label: "Last month", params: { period: "last-month" } },
  { kind: "ytd", label: "Year to date", params: { period: "ytd" } },
];
const PICKERS: { kind: Picker; label: string }[] = [
  { kind: "month", label: "Select month" },
  { kind: "day", label: "Single day" },
  { kind: "range", label: "Custom range" },
];

const viewOf = (date: string): View => ({ year: Number(date.slice(0, 4)), month: Number(date.slice(5, 7)) });
const formatLong = (date: string) => new Intl.DateTimeFormat("en-MY", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${date}T00:00:00Z`));
const subscribe = () => () => {};

// Menu rows match the Branch dropdown's options: 44px, left-aligned single-line labels, the
// selected row tinted teal with a right-aligned check.
const rowClass = (selected: boolean) => cn(
  "flex min-h-11 w-full items-center gap-2 rounded-lg px-3 text-left text-sm text-foreground transition-colors hover:bg-muted focus-visible:bg-muted focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary",
  selected && "bg-primary/[0.07] font-semibold text-primary hover:bg-primary/[0.12] focus-visible:bg-primary/[0.12]",
);
const iconButton = "grid size-9 shrink-0 place-items-center rounded-lg text-slate-600 hover:bg-muted disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-primary";

/**
 * Finance period selector. The popover opens on a menu: This month, Last month and Year to date
 * apply at once; Select month, Single day and Custom range open their picker as a second view
 * with Back. Nothing changes until a complete selection is made (a month or a day, or a range
 * confirmed with Apply); Back, Cancel, Escape or clicking outside keep the applied period.
 * `onChange` receives the URL params (the caller navigates). Dates are plain YYYY-MM-DD strings;
 * `today` is the Malaysia date from the server and later days are disabled. Before hydration it
 * renders a native month input for the surrounding GET form.
 */
export function PeriodPicker({ period, today, onChange }: { period: Pick<FinancePeriod, "kind" | "start" | "last" | "name" | "range">; today: string; onChange: (params: Record<string, string>) => void }) {
  const id = useId();
  const hydrated = useSyncExternalStore(subscribe, () => true, () => false);
  const [open, setOpen] = useState(false);
  const [picker, setPicker] = useState<Picker | null>(null);
  const [view, setView] = useState<View>(() => viewOf(period.last));
  const [draft, setDraft] = useState({ from: "", to: "" });
  // Element to focus after the view changes: a menu row (data-row), a day (data-date) or "back".
  const [focusTarget, setFocusTarget] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const todayYear = Number(today.slice(0, 4));
  const todayMonth = today.slice(0, 7);
  const selectedDay = period.kind === "day" ? period.start : null;
  const selectedMonth = period.kind === "month" ? period.start.slice(0, 7) : null;
  const focusDate = focusTarget?.startsWith("date:") ? focusTarget.slice(5) : null;

  // Close on outside click/tap (the applied period is unchanged).
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => { if (!rootRef.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  // Move focus after opening, switching views, arrow keys or a month change.
  useEffect(() => {
    if (!open || !focusTarget) return;
    const [type, value] = [focusTarget.slice(0, focusTarget.indexOf(":")), focusTarget.slice(focusTarget.indexOf(":") + 1)];
    const selector = type === "row" ? `[data-row="${value}"]` : type === "date" ? `[data-date="${value}"]` : `[data-focus="${value}"]`;
    panelRef.current?.querySelector<HTMLElement>(selector)?.focus();
  }, [open, focusTarget, view, picker]);

  function show() {
    setPicker(null);
    setFocusTarget(`row:${period.kind}`);
    setOpen(true);
  }
  function close(returnFocus = true) {
    setOpen(false);
    setPicker(null);
    if (returnFocus) requestAnimationFrame(() => triggerRef.current?.focus());
  }
  function choose(params: Record<string, string>) {
    close();
    onChange(params);
  }
  function openPicker(next: Picker) {
    // Each picker starts from the applied period (or today) with an empty range draft.
    setView(viewOf(period.kind === next ? (next === "range" ? period.last : period.start) : today));
    setDraft(period.kind === "range" && next === "range" ? { from: period.start, to: period.last } : { from: "", to: "" });
    setPicker(next);
    setFocusTarget(next === "day" && selectedDay ? `date:${selectedDay}` : "focus:back");
  }
  function back() {
    const from = picker;
    setPicker(null);
    setFocusTarget(`row:${from}`);
  }
  function moveView(step: number) {
    setFocusTarget(null);
    setView((v) => {
      if (picker === "month") return { ...v, year: Math.min(todayYear, Math.max(MIN_YEAR, v.year + step)) };
      const index = v.year * 12 + (v.month - 1) + step;
      return { year: Math.floor(index / 12), month: (index % 12) + 1 };
    });
  }
  function pickRangeDay(date: string) {
    // First click (or a click after a complete range, or before the start) sets the start, so the
    // end can never be earlier than the start.
    setDraft((d) => (!d.from || d.to || date < d.from ? { from: date, to: "" } : { from: d.from, to: date }));
  }
  function onDayKey(event: React.KeyboardEvent, date: string) {
    const steps: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
    if (!(event.key in steps)) return;
    event.preventDefault();
    const target = shiftDays(date, steps[event.key]);
    if (target > today || target < `${MIN_YEAR}-01-01`) return;
    setView(viewOf(target));
    setFocusTarget(`date:${target}`);
  }
  /** Up/Down/Home/End move between menu rows (Tab still leaves the menu). */
  function onMenuKey(event: React.KeyboardEvent<HTMLUListElement>) {
    const rows = [...event.currentTarget.querySelectorAll<HTMLButtonElement>("[data-row]")];
    const index = rows.indexOf(document.activeElement as HTMLButtonElement);
    const next = event.key === "ArrowDown" ? index + 1 : event.key === "ArrowUp" ? index - 1 : event.key === "Home" ? 0 : event.key === "End" ? rows.length - 1 : null;
    if (next === null) return;
    event.preventDefault();
    rows[(next + rows.length) % rows.length]?.focus();
  }

  const atLatest = picker === "month" ? view.year >= todayYear : ymd(view.year, view.month, 1).slice(0, 7) >= todayMonth;
  const atEarliest = picker === "month" ? view.year <= MIN_YEAR : view.year <= MIN_YEAR && view.month === 1;
  const years = Array.from({ length: todayYear - MIN_YEAR + 1 }, (_, i) => todayYear - i);
  const viewMonth = ymd(view.year, view.month, 1).slice(0, 7);
  // Roving tab stop: the focused, selected or current day if it's in view, else the 1st.
  const tabDate = [focusDate, picker === "range" ? draft.from : selectedDay, today].find((d) => d?.startsWith(viewMonth)) ?? ymd(view.year, view.month, 1);
  const smallSelect = "!min-h-0 !w-auto !rounded-lg !px-2 !py-1.5 !text-sm font-semibold focus-visible:!outline-none focus-visible:ring-2 focus-visible:ring-primary/30";
  const pickerTitle = PICKERS.find((p) => p.kind === picker)?.label ?? "";

  return (
    <div
      ref={rootRef}
      className="min-w-0"
      // Keyboard focus leaving the control (e.g. Tab) closes it without applying anything.
      onBlur={(event) => { if (open && event.relatedTarget && !rootRef.current?.contains(event.relatedTarget as Node)) close(false); }}
    >
      <label htmlFor={id} className="mb-2">Period</label>
      <div className="relative">
        {hydrated ? (
          <>
            <button
              ref={triggerRef}
              id={id}
              type="button"
              aria-haspopup="dialog"
              aria-expanded={open}
              aria-controls={`${id}-panel`}
              aria-describedby={period.name !== period.range ? `${id}-range` : undefined}
              onClick={() => (open ? close(false) : show())}
              onKeyDown={(event) => {
                if (event.key === "ArrowDown" && !open) { event.preventDefault(); show(); }
                if (event.key === "Escape" && open) { event.preventDefault(); close(); }
              }}
              className={cn(triggerClass, open && "border-primary ring-4 ring-primary/15")}
            >
              <CalendarDays size={16} aria-hidden className="pointer-events-none shrink-0 text-primary" />
              <span className="min-w-0 flex-1 truncate">
                {period.name}
                {/* Wider screens: the range follows the name; phones show it beneath the trigger. */}
                {period.name !== period.range && <span aria-hidden className="hidden font-normal text-slate-500 sm:inline"> · {period.range}</span>}
              </span>
            </button>
            <ChevronDown size={16} aria-hidden className={cn("pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 transition-transform duration-150", open && "rotate-180 text-primary")} />
            {open && (
              <div
                ref={panelRef}
                id={`${id}-panel`}
                role="dialog"
                aria-label={picker ? pickerTitle : "Choose a period"}
                onKeyDown={(event) => { if (event.key === "Escape") { event.preventDefault(); close(); } }}
                className={cn(
                  "popover-in absolute left-0 top-[calc(100%+0.375rem)] z-40 max-w-[calc(100vw-2rem)] rounded-xl border border-border bg-white shadow-[0_16px_40px_-12px_#071e3033,0_2px_6px_#071e3010]",
                  picker ? "w-[21rem] p-3" : "w-[18.5rem] p-1.5",
                )}
              >
                {!picker ? (
                  <ul role="menu" aria-label="Period" onKeyDown={onMenuKey}>
                    {PRESETS.map((p) => {
                      const selected = period.kind === p.kind;
                      return (
                        <li key={p.kind} role="none">
                          <button type="button" role="menuitemradio" aria-checked={selected} data-row={p.kind} tabIndex={selected ? 0 : -1} onClick={() => choose(p.params)} className={rowClass(selected)}>
                            <span className="min-w-0 flex-1 truncate">{p.label}</span>
                            <Check size={16} aria-hidden className={cn("shrink-0 text-primary", !selected && "invisible")} />
                          </button>
                        </li>
                      );
                    })}
                    <li role="separator" className="mx-2 my-1.5 h-px bg-border" />
                    {PICKERS.map((p) => {
                      const selected = period.kind === p.kind;
                      return (
                        <li key={p.kind} role="none">
                          <button type="button" role="menuitem" aria-haspopup="dialog" data-row={p.kind} tabIndex={selected ? 0 : -1} onClick={() => openPicker(p.kind)} className={rowClass(selected)}>
                            <span className="min-w-0 flex-1 truncate">{p.label}{selected && <span className="sr-only"> (current: {period.range})</span>}</span>
                            {selected && <Check size={16} aria-hidden className="shrink-0 text-primary" />}
                            <ChevronRight size={16} aria-hidden className="shrink-0 text-slate-400" />
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <>
                    {/* Second view: Back keeps the applied period. */}
                    <div className="mb-2 flex items-center gap-2 border-b border-border pb-2">
                      <button type="button" data-focus="back" onClick={back} className="inline-flex min-h-9 items-center gap-1 rounded-lg pl-1 pr-2.5 text-sm font-semibold text-slate-600 hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-primary">
                        <ChevronLeft size={16} aria-hidden /> Back
                      </button>
                      <p className="min-w-0 truncate text-sm font-semibold">{pickerTitle}</p>
                    </div>

                    {/* Navigation: previous / month & year jump / next */}
                    <div className="mb-2 flex items-center justify-between gap-1">
                      <button type="button" onClick={() => moveView(-1)} disabled={atEarliest} aria-label={picker === "month" ? "Previous year" : "Previous month"} className={iconButton}><ChevronLeft size={18} aria-hidden /></button>
                      <div className="flex min-w-0 items-center gap-1">
                        {picker !== "month" && (
                          <select aria-label="Month" value={view.month} onChange={(e) => { setFocusTarget(null); setView((v) => ({ ...v, month: Number(e.target.value) })); }} className={smallSelect}>
                            {MONTH_NAMES.map((name, i) => <option key={name} value={i + 1} disabled={ymd(view.year, i + 1, 1).slice(0, 7) > todayMonth}>{name}</option>)}
                          </select>
                        )}
                        <select aria-label="Year" value={view.year} onChange={(e) => { setFocusTarget(null); setView((v) => { const year = Number(e.target.value); return { year, month: year === todayYear ? Math.min(v.month, Number(today.slice(5, 7))) : v.month }; }); }} className={smallSelect}>
                          {years.map((y) => <option key={y} value={y}>{y}</option>)}
                        </select>
                      </div>
                      <button type="button" onClick={() => moveView(1)} disabled={atLatest} aria-label={picker === "month" ? "Next year" : "Next month"} className={iconButton}><ChevronRight size={18} aria-hidden /></button>
                    </div>

                    {picker === "month" ? (
                      <div role="group" className="grid grid-cols-3 gap-1.5" aria-label={`Months of ${view.year}`}>
                        {MONTH_NAMES.map((name, i) => {
                          const month = ymd(view.year, i + 1, 1).slice(0, 7);
                          const isSelected = month === selectedMonth;
                          return (
                            <button key={month} type="button" disabled={month > todayMonth} aria-pressed={isSelected} aria-label={`${name} ${view.year}`} onClick={() => choose({ month })}
                              className={cn("min-h-10 rounded-lg px-2 py-2 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:text-slate-300", isSelected ? "bg-primary font-semibold text-white" : "hover:bg-muted", month === todayMonth && !isSelected && "font-semibold text-primary ring-1 ring-inset ring-primary/40")}>
                              {name.slice(0, 3)}
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <div role="group" aria-label={`${MONTH_NAMES[view.month - 1]} ${view.year}. Use arrow keys to move between days.`}>
                        <div aria-hidden className="grid grid-cols-7 text-center text-xs font-semibold text-slate-500">
                          {WEEKDAYS_MONDAY_FIRST.map((d) => <span key={d} className="py-1.5">{d}</span>)}
                        </div>
                        <div className="grid grid-cols-7 gap-y-0.5">
                          {Array.from({ length: mondayIndex(view.year, view.month, 1) }, (_, i) => <span key={`blank-${i}`} aria-hidden />)}
                          {Array.from({ length: daysInMonth(view.year, view.month) }, (_, i) => {
                            const date = ymd(view.year, view.month, i + 1);
                            const isEnd = picker === "day" ? date === selectedDay : date === draft.from || date === draft.to;
                            const inside = picker === "range" && !!draft.from && !!draft.to && date > draft.from && date < draft.to;
                            return (
                              <button
                                key={date}
                                type="button"
                                data-date={date}
                                disabled={date > today}
                                aria-pressed={isEnd || inside}
                                aria-label={`${formatLong(date)}${picker === "range" && date === draft.from ? ", start" : ""}${picker === "range" && date === draft.to ? ", end" : ""}`}
                                aria-current={date === today ? "date" : undefined}
                                tabIndex={date === tabDate ? 0 : -1}
                                onClick={() => (picker === "day" ? choose({ date }) : pickRangeDay(date))}
                                onKeyDown={(event) => onDayKey(event, date)}
                                className={cn(
                                  "grid h-9 place-items-center rounded-lg text-sm tabular-nums transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary disabled:cursor-not-allowed disabled:text-slate-300",
                                  isEnd ? "bg-primary font-semibold text-white" : inside ? "rounded-none bg-primary/10 text-foreground" : "text-foreground hover:bg-muted",
                                  date === today && !isEnd && "font-semibold text-primary ring-1 ring-inset ring-primary/40",
                                )}
                              >
                                {i + 1}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {picker === "day" && (
                      <div className="mt-2 flex justify-end border-t border-border pt-2">
                        <button type="button" onClick={() => choose({ date: today })} className="min-h-9 rounded-lg px-3 text-sm font-semibold text-primary hover:bg-primary/5 focus-visible:outline-2 focus-visible:outline-primary">Today</button>
                      </div>
                    )}

                    {picker === "range" && (
                      <div className="mt-3 border-t border-border pt-3">
                        <dl className="grid grid-cols-2 gap-2 text-sm" aria-live="polite">
                          {/* The box awaiting a date is highlighted. */}
                          <div className={cn("min-w-0 rounded-lg border px-2.5 py-1.5", !draft.from ? "border-primary/50 bg-primary/[0.04]" : "border-border")}>
                            <dt className="text-xs text-slate-500">Start</dt>
                            <dd className="truncate font-semibold">{draft.from ? formatRange(draft.from, draft.from) : "Select a date"}</dd>
                          </div>
                          <div className={cn("min-w-0 rounded-lg border px-2.5 py-1.5", draft.from && !draft.to ? "border-primary/50 bg-primary/[0.04]" : "border-border")}>
                            <dt className="text-xs text-slate-500">End (inclusive)</dt>
                            <dd className="truncate font-semibold">{draft.to ? formatRange(draft.to, draft.to) : "Select a date"}</dd>
                          </div>
                        </dl>
                        <div className="mt-3 flex justify-end gap-2">
                          <button type="button" onClick={() => close()} className="min-h-10 rounded-lg px-3 text-sm font-semibold text-slate-600 hover:bg-muted focus-visible:outline-2 focus-visible:outline-primary">Cancel</button>
                          <button type="button" disabled={!draft.from || !draft.to} onClick={() => choose({ from: draft.from, to: draft.to })} className="min-h-10 rounded-lg bg-primary px-4 text-sm font-semibold text-white hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">Apply</button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </>
        ) : (
          <>
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2"><CalendarDays size={16} aria-hidden className="text-primary" /></span>
            {/* Global input styles are unlayered where they apply, so overrides use `!`. */}
            <input id={id} type="month" name="month" defaultValue={period.start.slice(0, 7)} min={`${MIN_YEAR}-01`} max={todayMonth} className={cn(triggerClass, "!pl-9 !pr-3")} />
          </>
        )}
      </div>
      {/* Phones: the date range as secondary text beneath the trigger (inline from sm). */}
      {period.name !== period.range && <p id={`${id}-range`} className="mt-1 truncate text-xs text-slate-500 sm:sr-only">{period.range}</p>}
    </div>
  );
}
