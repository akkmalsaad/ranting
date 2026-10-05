"use client";
import { useCallback, useId, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarClock, CalendarDays, ChevronDown, ChevronLeft, ChevronRight, CircleCheck, CircleX, Eye, Loader2, Pencil, Repeat, X } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Badge } from "@/components/ui/badge";
import { SuccessNote } from "@/components/notice";
import { ModalHeader } from "@/components/form-dialog";
import { EmptyState } from "@/components/empty-state";
import { Pagination } from "@/components/pagination";
import { triggerClass } from "@/components/finance/branch-select";
import { EditClassDialog } from "@/components/classes/class-form";
import { CalendarChip, CalendarPopover, ClassPopoverContent, DayPopoverContent, NOT_CLOSED_LABEL, NotClosedDot, classTiming, isUnclosed, describeSeries, fullDate, shortDate, useMalaysiaTime } from "@/components/classes/calendar-entries";
import { MONTH_NAMES, longDate } from "@/lib/calendar";
import { showBranchDetail } from "@/lib/branch-colors";
import { BranchCodeBadge } from "@/components/branch-code-badge";
import { CLASS_STATUS_LABELS, branchColors, classesHref, formatClassRange, formatClassTime, getBranchColor, monthGrid, shiftMonth, type BranchTone, type ClassBranch, type ClassSession } from "@/lib/classes-shared";
import { cancelSeriesFrom, setClassStatus } from "@/app/clubs/[clubId]/classes/actions";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 25;
/** Chips per calendar day before "+N more". */
const MAX_CHIPS = 3;
const WEEKDAYS = [["Mon", "Monday"], ["Tue", "Tuesday"], ["Wed", "Wednesday"], ["Thu", "Thursday"], ["Fri", "Friday"], ["Sat", "Saturday"], ["Sun", "Sunday"]] as const;
const WeeklyMark = ({ session }: { session: ClassSession }) => (session.series_id ? <Repeat size={13} aria-label="Weekly class" role="img" className="ml-1.5 inline-block shrink-0 align-[-1px] text-slate-400" /> : null);
const monthLabel = (month: string) => `${MONTH_NAMES[Number(month.slice(5, 7)) - 1]} ${month.slice(0, 4)}`;

type Props = {
  clubId: string;
  base: string;
  /** Today in Asia/Kuala_Lumpur (YYYY-MM-DD), and the time ("HH:MM") when the page was rendered. */
  today: string;
  now: string;
  /** Visible month (YYYY-MM) and optional selected day (YYYY-MM-DD) from the URL. */
  month: string;
  date: string;
  /** Branch filter ("" = all branches). */
  branch: string;
  page: number;
  /** Sessions in the visible grid (six weeks at most), ordered by date and start time. */
  sessions: ClassSession[];
  limited: boolean;
  /** All of the club's branches (for names/colours, including archived) and current ones (for forms). */
  branches: ClassBranch[];
  activeBranches: ClassBranch[];
};

/**
 * Classes calendar (main display) with the class table beneath it. Both share the URL's branch,
 * month and selected-day filters, so links, Back and refresh keep the same view. Selecting a day
 * filters the table; "Show whole month" or changing month clears it. The details, edit and
 * cancel dialogs open on top of the page; status changes are explicit (never automatic).
 */
export function ClassesWorkspace(props: Props) {
  const { clubId, base, today, month, date, branch, page, sessions, limited, branches, activeBranches } = props;
  const router = useRouter();
  const [navigating, startNavigation] = useTransition();
  const go = useCallback((href: string) => startNavigation(() => router.push(href, { scroll: false })), [router]);

  const colors = useMemo(() => branchColors(branches), [branches]);
  const branchById = useMemo(() => new Map(branches.map((b) => [b.id, b])), [branches]);
  const byId = useMemo(() => new Map(sessions.map((s) => [s.id, s])), [sessions]);
  // Full branch names (the legend): only when several branches can appear (shared rule with Fees).
  // Chips never show the full name; their short-code badge shows whenever the branch has a code.
  const showBranch = showBranchDetail({ filtered: !!branch, activeBranches: activeBranches.length, branchIdsInView: sessions.map((s) => s.branch_id) });

  const href = useCallback((p: { month?: string; date?: string; page?: number }) => classesHref(base, { ...p, branch }), [base, branch]);

  // Dialogs: kept by id so they show fresh data after the page refreshes. Focus returns to the
  // control that opened them.
  const [viewing, setViewing] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const opener = useRef<HTMLElement | null>(null);
  // `from`: the control to refocus when it isn't the focused element (e.g. a calendar chip whose
  // popover is closing).
  const remember = (from?: HTMLElement) => { if (!viewing && !editing && !cancelling) opener.current = from ?? (document.activeElement as HTMLElement | null); };
  const actions: RowActions = {
    view: (id, from) => { remember(from); setMessage(""); setViewing(id); },
    edit: (id, from) => { remember(from); setMessage(""); setViewing(null); setEditing(id); },
    cancel: (id) => { remember(); setMessage(""); setViewing(null); setCancelling(id); },
  };
  const restoreFocus = useCallback(() => requestAnimationFrame(() => { if (opener.current?.isConnected) opener.current.focus(); }), []);
  const closeView = useCallback(() => { setViewing(null); restoreFocus(); }, [restoreFocus]);
  const closeEdit = useCallback(() => { setEditing(null); restoreFocus(); }, [restoreFocus]);
  const closeCancel = useCallback(() => { setCancelling(null); restoreFocus(); }, [restoreFocus]);

  // Table rows: the visible month (not the neighbouring days shown in the grid) or the selected day.
  const rows = useMemo(() => sessions.filter((s) => (date ? s.session_date === date : s.session_date.startsWith(month))), [sessions, date, month]);
  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const currentPage = Math.min(page, pages);
  const pageRows = rows.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const filtered = branch ? branchById.get(branch) : undefined;
  const heading = date ? `Classes on ${longDate(date)}` : `Classes in ${monthLabel(month)}`;

  const helpers = { colors, branchById, showBranch, actions };
  const viewed = viewing ? byId.get(viewing) : undefined;
  const edited = editing ? byId.get(editing) : undefined;
  const cancelled = cancelling ? byId.get(cancelling) : undefined;

  return (
    <div aria-busy={navigating}>
      {message && <SuccessNote className="mb-6">{message}</SuccessNote>}

      <Calendar {...props} helpers={helpers} href={href} go={go} navigating={navigating} />

      <section aria-labelledby="class-table-heading" className="mt-10">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="class-table-heading" className="text-xl! tracking-[-0.02em]!">{heading}</h2>
            <p className="mt-0.5 text-[0.8125rem] text-slate-500" aria-live="polite">
              {rows.length} {rows.length === 1 ? "class" : "classes"}{filtered ? ` · ${filtered.name}` : " · all branches"}
            </p>
          </div>
          {date && <Link href={href({ month })} scroll={false} onClick={(e) => { if (plainClick(e)) { e.preventDefault(); go(href({ month })); } }} className={buttonVariants({ variant: "outline", size: "sm" })}><CalendarDays size={16} aria-hidden /> Show whole month</Link>}
        </div>
        {limited && <p className="mb-3 rounded-xl border border-amber-200/80 bg-amber-50 px-4 py-3 text-sm text-amber-900">Only the first 1,500 classes in this view are shown. Filter by branch to see the rest.</p>}

        {rows.length === 0 ? (
          <EmptyState
            icon={CalendarDays}
            title={date ? "No classes on this day" : "No classes this month"}
            description={activeBranches.length === 0 ? "Add a branch first, then schedule its classes." : date ? "Use Add class to schedule one, or show the whole month." : "Use Add class to schedule your club's training sessions."}
          />
        ) : (
          <>
            <ClassTable rows={pageRows} {...helpers} />
            <ClassCards rows={pageRows} {...helpers} />
          </>
        )}

        {pages > 1 && <Pagination page={currentPage} pages={pages} scroll={false} previousHref={currentPage > 1 ? href({ month: date ? undefined : month, date, page: currentPage - 1 }) : undefined} nextHref={currentPage < pages ? href({ month: date ? undefined : month, date, page: currentPage + 1 }) : undefined} />}
      </section>

      {viewed && <ClassDetails clubId={clubId} session={viewed} branch={branchById.get(viewed.branch_id)} tone={getBranchColor(colors, viewed.branch_id)} actions={actions} onClose={closeView} />}
      {edited && <EditClassDialog clubId={clubId} session={edited} branches={activeBranches} allBranches={branches} currentBranch={branch} onClose={closeEdit} />}
      {cancelled && <CancelClass clubId={clubId} session={cancelled} branchName={branchById.get(cancelled.branch_id)?.name} onClose={closeCancel} onDone={(text) => { setMessage(text); closeCancel(); }} />}
    </div>
  );
}

type RowActions = { view: (id: string, from?: HTMLElement) => void; edit: (id: string, from?: HTMLElement) => void; cancel: (id: string) => void };
type Helpers = { colors: Map<string, BranchTone>; branchById: Map<string, ClassBranch>; showBranch: boolean; actions: RowActions };

/** A normal left click (not opening a new tab), so it can run as an in-page transition. */
const plainClick = (e: React.MouseEvent) => e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey;

// --- Calendar -------------------------------------------------------------------------------

type PopoverView = { kind: "class"; id: string; day?: string } | { kind: "day"; day: string };

function Calendar({ clubId, today, now: renderedAt, month, date, sessions, helpers, href, go, navigating }: Props & { helpers: Helpers; href: (p: { month?: string; date?: string }) => string; go: (href: string) => void; navigating: boolean }) {
  const { weeks } = useMemo(() => monthGrid(month), [month]);
  // Sessions arrive ordered by date, start time and name, so each day's list is in start-time order.
  const byDay = useMemo(() => {
    const map = new Map<string, ClassSession[]>();
    for (const s of sessions) {
      const list = map.get(s.session_date);
      if (list) list.push(s);
      else map.set(s.session_date, [s]);
    }
    return map;
  }, [sessions]);
  const byId = useMemo(() => new Map(sessions.map((s) => [s.id, s])), [sessions]);
  const nav = (target: string) => (e: React.MouseEvent) => { if (plainClick(e)) { e.preventDefault(); go(target); } };
  const usedBranches = useMemo(() => [...new Set(sessions.filter((s) => s.session_date.startsWith(month)).map((s) => s.branch_id))], [sessions, month]);
  const now = useMalaysiaTime(renderedAt);
  const timing = (s: ClassSession) => classTiming(s, today, now);
  const branchName = (id: string) => helpers.branchById.get(id)?.name ?? "Branch";

  // One popover for the calendar: a class (from its chip) or a busy day's full list (from "+N more").
  const popoverTitle = useId();
  const [popover, setPopover] = useState<{ anchor: HTMLElement; view: PopoverView } | null>(null);
  const shown = popover && (popover.view.kind === "day" || byId.has(popover.view.id)) ? popover : null;
  const close = (refocus: boolean) => { const anchor = popover?.anchor; setPopover(null); if (refocus) anchor?.focus({ preventScroll: true }); };
  /** Hands over to a modal: the popover closes and the modal returns focus to the chip. */
  const handOff = (open: (id: string, from?: HTMLElement) => void, id: string) => { const anchor = popover?.anchor; setPopover(null); open(id, anchor); };
  const chip = (s: ClassSession, expanded: boolean, onOpen: (anchor: HTMLElement) => void) => (
    <CalendarChip session={s} branchName={branchName(s.branch_id)} branchCode={helpers.branchById.get(s.branch_id)?.short_code ?? null} tone={getBranchColor(helpers.colors, s.branch_id)} timing={timing(s)} expanded={expanded} onOpen={onOpen} />
  );

  return (
    <section aria-labelledby="calendar-heading" className="overflow-hidden rounded-2xl border border-border bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4 sm:px-6">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <h2 id="calendar-heading" className="text-xl! tracking-[-0.02em]!" aria-live="polite">{monthLabel(month)}</h2>
            {navigating && <span role="status" className="inline-flex items-center gap-1 text-xs font-medium text-primary"><Loader2 size={12} aria-hidden className="animate-spin motion-reduce:animate-none" /> Loading…</span>}
          </div>
          {/* Branch colour key, whenever chips are coloured by branch (names may not fit on them). */}
          {helpers.showBranch && usedBranches.length > 0 && (
            <ul aria-label="Branch colours" className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
              {usedBranches.map((id) => <li key={id} className="inline-flex items-center gap-1.5"><span aria-hidden className={cn("size-2.5 rounded-[3px]", getBranchColor(helpers.colors, id).dot)} />{branchName(id)}</li>)}
            </ul>
          )}
        </div>
        {/* Mobile: month/year selects on one full-width row, Today and the arrows on the next.
            sm and up: one wrapping row, as before. */}
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center">
          <MonthYearPicker month={month} today={today} href={href} go={go} />
          <div className="flex items-center gap-2">
            <Link href={href({ month: today.slice(0, 7), date: today })} scroll={false} onClick={nav(href({ month: today.slice(0, 7), date: today }))} className={cn(buttonVariants({ variant: "outline" }), "min-h-10 flex-1 px-4 py-0 sm:flex-none")}>Today</Link>
            <div className="flex items-center gap-1">
              <Link href={href({ month: shiftMonth(month, -1) })} scroll={false} onClick={nav(href({ month: shiftMonth(month, -1) }))} aria-label={`Previous month, ${monthLabel(shiftMonth(month, -1))}`} className={cn(buttonVariants({ variant: "outline" }), "size-10 min-h-10 p-0")}><ChevronLeft size={18} aria-hidden /></Link>
              <Link href={href({ month: shiftMonth(month, 1) })} scroll={false} onClick={nav(href({ month: shiftMonth(month, 1) }))} aria-label={`Next month, ${monthLabel(shiftMonth(month, 1))}`} className={cn(buttonVariants({ variant: "outline" }), "size-10 min-h-10 p-0")}><ChevronRight size={18} aria-hidden /></Link>
            </div>
          </div>
        </div>
      </div>

      {/* Month grid, Monday first. Each day is a link that selects it (filters the list below; on
          phones that list is how a day's classes are read). Chips and "+N more" are separate
          buttons layered above the day link. */}
      <div>
        <div aria-hidden className="grid grid-cols-7 border-b border-border bg-slate-50/80">
          {WEEKDAYS.map(([short, full]) => <div key={full} className="px-1 py-2.5 text-center text-xs font-semibold text-slate-500 md:px-3 md:text-left">{short}</div>)}
        </div>
        {weeks.map((week) => (
          <div key={week[0]} className="grid grid-cols-7 border-b border-border last:border-b-0">
            {week.map((day) => {
              const list = byDay.get(day) ?? [];
              const inMonth = day.startsWith(month);
              const isToday = day === today;
              const isSelected = day === date;
              const hidden = list.length - MAX_CHIPS;
              const dayOpen = shown !== null && shown.view.day === day;
              const label = `${fullDate(day)}${isToday ? ", today" : ""}. ${list.length === 0 ? "No classes" : `${list.length} ${list.length === 1 ? "class" : "classes"}`}${isSelected ? ". Selected" : ". Select to show this day's classes"}`;
              return (
                <div key={day} className={cn("relative min-h-16 border-r border-border p-1 last:border-r-0 md:min-h-28 md:p-2", !inMonth && "bg-muted/60", isSelected && "bg-navy/[.06]")}>
                  <Link href={href({ date: day })} scroll={false} onClick={nav(href({ date: day }))} aria-label={label} aria-current={isToday ? "date" : undefined} className="absolute inset-0 z-0 rounded-none transition-colors hover:bg-navy/[.03] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary" />
                  <div className="pointer-events-none relative z-10 flex flex-col items-center md:items-stretch">
                    <span className={cn("grid size-7 place-items-center rounded-full text-sm tabular-nums md:self-start", !inMonth && "text-slate-400", isToday && "bg-navy font-bold text-white")}>{Number(day.slice(8))}</span>
                    {/* Phones: up to three dots (grey when past, hollow when cancelled); the day link carries the count. */}
                    {list.length > 0 && (
                      <span className={cn("mt-1 flex items-center gap-0.5 md:hidden", !inMonth && "opacity-60")} aria-hidden>
                        {list.slice(0, MAX_CHIPS).map((s) => <span key={s.id} className={cn("size-1.5 rounded-full", s.status === "cancelled" ? "border border-slate-400" : timing(s) === "past" ? "bg-slate-400" : getBranchColor(helpers.colors, s.branch_id).dot)} />)}
                      </span>
                    )}
                    {/* md and up: at most three chips, then "+N more" opens the whole day. */}
                    {list.length > 0 && (
                      <ul className="mt-1 hidden space-y-1 md:block">
                        {list.slice(0, MAX_CHIPS).map((s) => (
                          <li key={s.id}>{chip(s, shown?.view.kind === "class" && shown.view.id === s.id && !shown.view.day, (anchor) => setPopover({ anchor, view: { kind: "class", id: s.id } }))}</li>
                        ))}
                        {hidden > 0 && (
                          <li>
                            <button type="button" onClick={(e) => setPopover({ anchor: e.currentTarget, view: { kind: "day", day } })} aria-haspopup="dialog" aria-expanded={dayOpen} aria-label={`Show all ${list.length} classes on ${longDate(day)}`} className="pointer-events-auto block w-full cursor-pointer rounded-md py-0.5 pl-3 pr-2 text-left text-xs font-semibold text-primary transition-colors hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">+{hidden} more</button>
                          </li>
                        )}
                      </ul>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Legend: how past, cancelled and completed classes look (never colour alone). */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-border px-4 py-3 text-xs text-slate-600 sm:px-6">
        <span className="inline-flex items-center gap-1.5"><span aria-hidden className="size-2.5 rounded-[3px] bg-slate-300" /> Past class</span>
        <span className="inline-flex items-center gap-1.5"><NotClosedDot className="size-2" /> {NOT_CLOSED_LABEL}</span>
        <span className="inline-flex items-center gap-1.5"><span aria-hidden className="size-2.5 rounded-[3px] border border-slate-400" /><span className="line-through">Cancelled</span> class</span>
        <span className="inline-flex items-center gap-1.5"><CircleCheck size={12} aria-hidden className="text-emerald-600" /> Completed</span>
        <span className="text-slate-500">Times in Malaysia time</span>
      </div>

      <CalendarPopover
        anchor={shown?.anchor ?? null}
        viewKey={shown ? (shown.view.kind === "day" ? `day:${shown.view.day}` : `class:${shown.view.id}`) : ""}
        labelledBy={popoverTitle}
        onDismiss={() => setPopover(null)}
      >
        {shown?.view.kind === "day" && (() => {
          const day = shown.view.day;
          return (
            <DayPopoverContent titleId={popoverTitle} day={day} onClose={() => close(true)} onShowList={() => { close(false); go(href({ date: day })); }}>
              {(byDay.get(day) ?? []).map((s) => <li key={s.id}>{chip(s, false, () => setPopover({ anchor: shown.anchor, view: { kind: "class", id: s.id, day } }))}</li>)}
            </DayPopoverContent>
          );
        })()}
        {shown?.view.kind === "class" && (() => {
          const s = byId.get(shown.view.id)!;
          const day = shown.view.day;
          return (
            <ClassPopoverContent
              key={s.id}
              clubId={clubId}
              titleId={popoverTitle}
              session={s}
              unclosed={isUnclosed(s, timing(s))}
              branch={helpers.branchById.get(s.branch_id)}
              tone={getBranchColor(helpers.colors, s.branch_id)}
              onEdit={() => handOff(helpers.actions.edit, s.id)}
              onDetails={() => handOff(helpers.actions.view, s.id)}
              onBack={day ? () => setPopover({ anchor: shown.anchor, view: { kind: "day", day } }) : undefined}
              onClose={() => close(true)}
            />
          );
        })()}
      </CalendarPopover>
    </section>
  );
}

/** Month and year selects that jump straight to a month (the arrows also work without JavaScript). */
function MonthYearPicker({ month, today, href, go }: { month: string; today: string; href: (p: { month?: string }) => string; go: (href: string) => void }) {
  const id = useId();
  const year = Number(month.slice(0, 4));
  const thisYear = Number(today.slice(0, 4));
  const years = [];
  for (let y = Math.min(year, thisYear - 5); y <= Math.max(year, thisYear + 5); y++) years.push(y);
  // The shared dropdown trigger look, sized to the toolbar buttons. The `!` overrides beat the
  // unlayered global `select` rule (width 100%, 0.75rem padding all round), which squeezed the text
  // out of the 40px box. appearance-none + our own chevron keeps the arrow clear of the text in
  // every browser; 16px text on mobile stops iOS Safari zooming in on focus. Native selects keep
  // the OS picker on phones, so the option list always fits the screen and is easy to tap.
  const select = cn(triggerClass, "block h-10 appearance-none !min-h-0 !w-full !py-0 !pl-3 !pr-9 !text-base !leading-normal sm:!w-auto sm:!text-sm focus-visible:!outline-none");
  const chevron = <ChevronDown size={16} aria-hidden className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-500" />;
  const change = (m: string) => go(href({ month: m }));
  return (
    <div className="grid w-full grid-cols-[minmax(9rem,3fr)_minmax(6rem,2fr)] gap-2 sm:flex sm:w-auto sm:items-center sm:gap-1.5">
      <div className="relative min-w-[9rem]">
        <label htmlFor={`${id}-month`} className="sr-only">Month</label>
        <select id={`${id}-month`} className={cn(select, "sm:min-w-[8.5rem]")} value={month.slice(5, 7)} onChange={(e) => change(`${month.slice(0, 4)}-${e.target.value}`)}>
          {MONTH_NAMES.map((name, i) => <option key={name} value={String(i + 1).padStart(2, "0")}>{name}</option>)}
        </select>
        {chevron}
      </div>
      <div className="relative min-w-[6rem]">
        <label htmlFor={`${id}-year`} className="sr-only">Year</label>
        <select id={`${id}-year`} className={cn(select, "sm:min-w-[6rem] tabular-nums")} value={year} onChange={(e) => change(`${e.target.value}-${month.slice(5, 7)}`)}>
          {years.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
        {chevron}
      </div>
    </div>
  );
}

// --- Table and cards ------------------------------------------------------------------------

/** Class status with an icon and text, never colour alone. */
export function ClassStatusBadge({ status }: { status: string }) {
  const [icon, tone] = status === "completed" ? [CircleCheck, "success" as const] : status === "cancelled" ? [CircleX, "neutral" as const] : [CalendarClock, "info" as const];
  return <Badge tone={tone} icon={icon}>{CLASS_STATUS_LABELS[status] ?? status}</Badge>;
}

function BranchLabel({ id, helpers }: { id: string; helpers: Helpers }) {
  const b = helpers.branchById.get(id);
  return (
    <span className="inline-flex min-w-0 items-center gap-2">
      <span aria-hidden className={cn("size-2.5 shrink-0 rounded-full", getBranchColor(helpers.colors, id).dot)} />
      <span className="break-words">{b?.name ?? "Unknown branch"}{b?.archived_at && <span className="text-slate-500"> (archived)</span>}</span>
    </span>
  );
}

const Instructor = ({ name }: { name: string | null }) => (name ? <span className="break-words">{name}</span> : <span className="text-slate-400">Not assigned</span>);

function RowButtons({ session, actions, compact = false }: { session: ClassSession; actions: RowActions; compact?: boolean }) {
  const small = "px-2.5";
  return (
    <span className={cn("inline-flex shrink-0 gap-1.5", compact ? "flex-wrap justify-start" : "justify-end")}>
      <Button type="button" variant="ghost" size="sm" className={small} onClick={() => actions.view(session.id)} aria-label={`View ${session.name} on ${longDate(session.session_date)}`}><Eye size={15} aria-hidden /> View</Button>
      <Button type="button" variant="outline" size="sm" className={small} onClick={() => actions.edit(session.id)} aria-label={`Edit ${session.name} on ${longDate(session.session_date)}`}><Pencil size={15} aria-hidden /> Edit</Button>
      {session.status === "scheduled" && <Button type="button" variant="ghost" size="sm" className={cn(small, "text-red-700 hover:bg-red-50 hover:text-red-800")} onClick={() => actions.cancel(session.id)} aria-label={`Cancel ${session.name} on ${longDate(session.session_date)}`}><X size={15} aria-hidden /> Cancel</Button>}
    </span>
  );
}

function ClassTable({ rows, ...helpers }: Helpers & { rows: ClassSession[] }) {
  return (
    <div className="hidden overflow-x-auto rounded-2xl border border-border bg-white md:block">
      <table className="data-table min-w-[64rem]">
        <caption className="sr-only">Classes</caption>
        <thead>
          <tr>
            <th scope="col" className="px-5 py-3">Class name</th>
            <th scope="col" className="px-5 py-3">Branch</th>
            <th scope="col" className="px-5 py-3">Date</th>
            <th scope="col" className="px-5 py-3">Time</th>
            <th scope="col" className="px-5 py-3">Instructor</th>
            <th scope="col" className="px-5 py-3">Status</th>
            <th scope="col" className="px-5 py-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((s) => (
            <tr key={s.id} className={cn("hover:bg-slate-50/80", s.status === "cancelled" && "text-slate-500")}>
              <td className="min-w-[11rem] px-5 py-4 align-middle">
                <button type="button" onClick={() => helpers.actions.view(s.id)} className={cn("break-words text-left font-semibold hover:text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary", s.status === "cancelled" && "line-through")}>{s.name}</button>
                <WeeklyMark session={s} />
              </td>
              <td className="px-5 py-4 align-middle"><BranchLabel id={s.branch_id} helpers={helpers} /></td>
              <td className="whitespace-nowrap px-5 py-4 align-middle">{shortDate(s.session_date)}</td>
              <td className="whitespace-nowrap px-5 py-4 align-middle tabular-nums">{formatClassRange(s)}</td>
              <td className="px-5 py-4 align-middle"><Instructor name={s.instructor_name} /></td>
              <td className="whitespace-nowrap px-5 py-4 align-middle"><ClassStatusBadge status={s.status} /></td>
              <td className="whitespace-nowrap px-5 py-4 text-right align-middle"><RowButtons session={s} actions={helpers.actions} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ClassCards({ rows, ...helpers }: Helpers & { rows: ClassSession[] }) {
  return (
    <ul className="overflow-hidden rounded-2xl border border-border bg-white md:hidden">
      {rows.map((s) => (
        <li key={s.id} className="border-b border-border px-4 py-4 last:border-b-0">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-2">
              <button type="button" onClick={() => helpers.actions.view(s.id)} className={cn("min-w-0 break-words text-left font-semibold hover:text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary", s.status === "cancelled" && "text-slate-500 line-through")}>{s.name}<WeeklyMark session={s} /></button>
              {(() => { const code = helpers.branchById.get(s.branch_id)?.short_code; return code ? <BranchCodeBadge code={code} tone={getBranchColor(helpers.colors, s.branch_id)} className="mt-1" /> : null; })()}
            </div>
            <ClassStatusBadge status={s.status} />
          </div>
          <dl className="mt-3 grid grid-cols-[auto_minmax(0,1fr)] items-start gap-x-4 gap-y-2 text-sm">
            <dt className="text-slate-500">Branch</dt><dd className="min-w-0"><BranchLabel id={s.branch_id} helpers={helpers} /></dd>
            <dt className="text-slate-500">Date</dt><dd>{shortDate(s.session_date)}</dd>
            <dt className="text-slate-500">Time</dt><dd className="tabular-nums">{formatClassRange(s)}</dd>
            <dt className="text-slate-500">Instructor</dt><dd className="min-w-0"><Instructor name={s.instructor_name} /></dd>
          </dl>
          <div className="mt-3"><RowButtons session={s} actions={helpers.actions} compact /></div>
        </li>
      ))}
    </ul>
  );
}

// --- Dialogs --------------------------------------------------------------------------------

/** Class details with explicit status actions: Mark completed, Cancel (confirmed) and Reopen. */
function ClassDetails({ clubId, session, branch, tone, actions, onClose }: { clubId: string; session: ClassSession; branch?: ClassBranch; tone: BranchTone; actions: RowActions; onClose: () => void }) {
  const titleId = useId();
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ error?: string; success?: string }>({});
  const change = (status: "scheduled" | "completed") => startTransition(async () => setResult(await setClassStatus(clubId, session.id, status)));
  const scheduled = session.status === "scheduled";
  return (
    <Modal labelledBy={titleId} onDismiss={onClose} className="sm:max-w-xl">
      <ModalHeader id={titleId} title={<span className={cn(session.status === "cancelled" && "text-slate-500 line-through")}>{session.name}</span>}>
        <div className="mb-3"><ClassStatusBadge status={session.status} /></div>
      </ModalHeader>
      <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-6 gap-y-3 rounded-xl bg-slate-50 p-4 text-sm ring-1 ring-inset ring-border">
        <dt className="text-slate-500">Branch</dt>
        <dd className="inline-flex min-w-0 items-center gap-2 font-medium"><span aria-hidden className={cn("size-2.5 shrink-0 rounded-full", tone.dot)} /><span className="break-words">{branch?.name ?? "Unknown branch"}{branch?.archived_at && <span className="font-normal text-slate-500"> (archived)</span>}</span></dd>
        <dt className="text-slate-500">Date</dt><dd className="font-medium">{shortDate(session.session_date)}</dd>
        <dt className="text-slate-500">Start time</dt><dd className="font-medium tabular-nums">{formatClassTime(session.start_time)}</dd>
        <dt className="text-slate-500">End time</dt><dd className="font-medium tabular-nums">{formatClassTime(session.end_time)}</dd>
        <dt className="text-slate-500">Instructor</dt><dd className="font-medium"><Instructor name={session.instructor_name} /></dd>
        <dt className="text-slate-500">Status</dt><dd className="font-medium">{CLASS_STATUS_LABELS[session.status] ?? session.status}</dd>
        <dt className="text-slate-500">Repeats</dt>
        <dd className="font-medium">{session.series ? <span className="inline-flex items-start gap-1.5"><Repeat size={15} aria-hidden className="mt-0.5 shrink-0 text-slate-500" />{describeSeries(session.series)}</span> : "Does not repeat"}</dd>
        <dt className="text-slate-500">Notes</dt><dd className="whitespace-pre-line break-words">{session.notes ?? <span className="text-slate-400">No notes</span>}</dd>
      </dl>
      <p className="mt-4 text-xs text-slate-500">Times are in Malaysia time (Asia/Kuala_Lumpur).{session.series_id ? " Changes here apply to this class only." : ""}</p>
      {result.error && <p role="alert" className="mt-5 rounded-xl border border-red-200/70 bg-red-50 px-4 py-3 text-sm text-red-800">{result.error}</p>}
      {result.success && <SuccessNote className="mt-5">{result.success}</SuccessNote>}
      <div className="mt-6 flex flex-wrap items-center gap-2.5 border-t border-border pt-5" aria-busy={pending}>
        <Button type="button" variant="outline" onClick={() => actions.edit(session.id)} disabled={pending}><Pencil size={16} aria-hidden /> Edit</Button>
        {scheduled && <Button type="button" onClick={() => change("completed")} disabled={pending}><CircleCheck size={16} aria-hidden /> {pending ? "Saving…" : "Mark completed"}</Button>}
        {scheduled && <Button type="button" variant="destructive" className="sm:ml-auto" onClick={() => actions.cancel(session.id)} disabled={pending}><X size={16} aria-hidden /> Cancel class</Button>}
        {!scheduled && <Button type="button" onClick={() => change("scheduled")} disabled={pending}><CalendarClock size={16} aria-hidden /> {pending ? "Saving…" : "Reopen"}</Button>}
      </div>
    </Modal>
  );
}

/**
 * Confirmation before cancelling: the class is kept (status Cancelled) and can be reopened.
 * For a weekly class, the owner chooses this class only or this and the following scheduled ones.
 */
function CancelClass({ clubId, session, branchName, onClose, onDone }: { clubId: string; session: ClassSession; branchName?: string; onClose: () => void; onDone: (message: string) => void }) {
  const titleId = useId();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [scope, setScope] = useState<"one" | "following">("one");
  const confirm = () => startTransition(async () => {
    const result = scope === "following" && session.series_id ? await cancelSeriesFrom(clubId, session.id) : await setClassStatus(clubId, session.id, "cancelled");
    if (result.error) setError(result.error);
    else onDone(result.success ?? "Class cancelled.");
  });
  return (
    <Modal labelledBy={titleId} onDismiss={onClose} className="sm:max-w-md">
      <ModalHeader id={titleId} title="Cancel this class?" />
      <p className="-mt-3 text-[0.9375rem] text-slate-600">
        <strong className="font-semibold text-foreground">{session.name}</strong>{branchName ? ` at ${branchName}` : ""} on {shortDate(session.session_date)}, {formatClassRange(session)}, will be marked as cancelled.
      </p>
      {session.series_id && (
        <fieldset className="mt-5 space-y-2" disabled={pending}>
          <legend className="mb-2 text-sm font-semibold">This is a weekly class</legend>
          {([["one", "Only this class", "Other classes in the series stay as they are."], ["following", "This and following classes", "Cancels this class and every later scheduled class in the series."]] as const).map(([value, label, hint]) => (
            <label key={value} className={cn("flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 font-normal transition-colors", scope === value ? "border-primary bg-primary/[.04]" : "border-border hover:bg-slate-50")}>
              <input type="radio" name="cancel-scope" value={value} checked={scope === value} onChange={() => setScope(value)} className="mt-1 size-4 accent-primary" />
              <span><span className="block text-sm font-semibold">{label}</span><span className="block text-sm text-slate-500">{hint}</span></span>
            </label>
          ))}
        </fieldset>
      )}
      <p className="mt-4 text-sm text-slate-500">Cancelled classes stay in your schedule and can be reopened later.</p>
      {error && <p role="alert" className="mt-5 rounded-xl border border-red-200/70 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>}
      <div className="mt-6 flex flex-col-reverse gap-2.5 sm:flex-row sm:justify-end">
        <Button type="button" variant="ghost" onClick={onClose} disabled={pending}>Keep class</Button>
        <Button type="button" variant="destructive" onClick={confirm} disabled={pending}>{pending ? "Cancelling…" : scope === "following" && session.series_id ? "Cancel classes" : "Cancel class"}</Button>
      </div>
    </Modal>
  );
}
