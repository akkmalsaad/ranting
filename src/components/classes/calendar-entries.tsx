"use client";
import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, useTransition } from "react";
import { ChevronLeft, CircleCheck, Eye, List, Pencil, Repeat, X } from "lucide-react";
import { cva } from "class-variance-authority";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CLASS_STATUS_LABELS, formatClassRange, formatClassRangeShort, formatClassTime, malaysiaTimeNow, type BranchTone, type ClassBranch, type ClassSession } from "@/lib/classes-shared";
import { CLASS_WEEKDAYS } from "@/lib/validation";
import { setClassStatus } from "@/app/clubs/[clubId]/classes/actions";
import { BranchCodeBadge } from "@/components/branch-code-badge";
import { cn } from "@/lib/utils";

// Calendar month-view pieces: the class chip, its time-based state, and the anchored popover that
// shows a class (or every class on a busy day). The grid itself is in classes-workspace.tsx.

export const fullDate = (date: string) => new Intl.DateTimeFormat("en-MY", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${date}T00:00:00Z`));
export const shortDate = (date: string) => new Intl.DateTimeFormat("en-MY", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${date}T00:00:00Z`));
const dayMonth = (date: string) => new Intl.DateTimeFormat("en-MY", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(`${date}T00:00:00Z`));
/** "Weekly on Mon, Wed · 6 Oct 2026 – 29 Dec 2026". */
export const describeSeries = (series: NonNullable<ClassSession["series"]>) =>
  `Weekly on ${CLASS_WEEKDAYS.filter((d) => series.weekdays.includes(d.value)).map((d) => d.short).join(", ")} · ${shortDate(series.start_date).replace(/^\w+, /, "")} – ${shortDate(series.end_date).replace(/^\w+, /, "")}`;

// --- Time-based state ----------------------------------------------------------------------

const subscribeClock = (onChange: () => void) => { const timer = setInterval(onChange, 30_000); return () => clearInterval(timer); };
/**
 * Malaysia wall-clock "HH:MM", refreshed every 30 seconds so classes turn "past" while the page is
 * open. Server rendering and hydration use `initial` (the server's time for this request), so the
 * markup matches and the first paint already greys out finished classes.
 */
export const useMalaysiaTime = (initial: string) => useSyncExternalStore(subscribeClock, () => malaysiaTimeNow(), () => initial);

export type ClassTiming = "past" | "today" | "upcoming";
/** A class that has ended but is still "scheduled": nobody has marked it completed (or cancelled it). */
export const isUnclosed = (s: Pick<ClassSession, "status">, timing: ClassTiming) => timing === "past" && s.status === "scheduled";
export const NOT_CLOSED_LABEL = "Not marked completed";

/** Amber "not closed" marker. Amber fill with a darker rim so it reaches 3:1 on the grey chip. */
export const NotClosedDot = ({ className }: { className?: string }) => (
  <span title={NOT_CLOSED_LABEL} className={cn("inline-block size-[7px] shrink-0 rounded-full bg-amber-500 ring-1 ring-inset ring-amber-700", className)} />
);
/** Past = ended before now (Malaysia time). `now` is "HH:MM"; "" treats today's classes as not ended. */
export function classTiming(s: Pick<ClassSession, "session_date" | "end_time">, today: string, now: string): ClassTiming {
  if (s.session_date < today) return "past";
  if (s.session_date > today) return "upcoming";
  return now && s.end_time.slice(0, 5) <= now ? "past" : "today";
}

// --- Chip ----------------------------------------------------------------------------------

/**
 * A straight accent bar (::before, inset 4px/6px) instead of a border-left, which bent around the
 * rounded corner. `branch` and `today` take their colours from the BranchTone (the bar uses
 * currentColor); `muted` (past or cancelled) is grey. Muted text is slate-700 / slate-600 on
 * bg-muted (#edf2f3), about 9:1 and 6.7:1: tokens, not opacity, so both lines pass WCAG AA.
 */
export const chipVariants = cva(
  "pointer-events-auto relative block w-full cursor-pointer rounded-md py-1.5 pl-3 pr-2 text-left text-xs leading-4 transition-colors before:absolute before:inset-y-1.5 before:left-1 before:w-[3px] before:rounded-full before:bg-current focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
  {
    variants: {
      look: {
        branch: "",
        today: "ring-1",
        muted: "bg-muted text-slate-700 before:bg-slate-400 hover:bg-slate-200/70",
      },
    },
    defaultVariants: { look: "branch" },
  },
);

/**
 * The inside of a calendar chip, shared by the calendar and the branch form's preview so they match:
 * line 1 is the class name (truncates first), the completed check and the branch code badge (never
 * shrinks); line 2 is the time only. The branch's full name is never on the chip.
 */
export function ChipContent({ name, time, code, tone, muted = false, cancelled = false, completed = false, unclosed = false }: {
  name: string;
  /** Compact range, e.g. "9–11 AM". */
  time: string;
  /** The branch's short code; no badge when null (codes are never generated on the fly). */
  code: string | null;
  tone: BranchTone;
  /** Past or cancelled: grey second line. */
  muted?: boolean;
  cancelled?: boolean;
  completed?: boolean;
  unclosed?: boolean;
}) {
  return (
    <>
      <span className="flex min-w-0 items-center gap-1">
        <span className={cn("min-w-0 truncate font-medium", cancelled && "line-through")}>{name}</span>
        {completed && <CircleCheck size={12} aria-hidden className="shrink-0 text-emerald-600" />}
        {code && <BranchCodeBadge code={code} tone={tone} className="ml-auto" />}
      </span>
      <span className={cn("flex min-w-0 items-center gap-1", muted ? "text-slate-600" : tone.sub)}>
        {unclosed && <NotClosedDot />}
        <span className="truncate tabular-nums">{time}</span>
      </span>
    </>
  );
}

export function CalendarChip({ session, branchName, branchCode, tone, timing, expanded, onOpen }: {
  session: ClassSession;
  /** Full branch name: in the aria-label only (the chip shows the code badge). */
  branchName: string;
  /** The branch's short code ("BA"): always shown as a badge when set, whatever the branch filter. */
  branchCode: string | null;
  tone: BranchTone;
  timing: ClassTiming;
  expanded: boolean;
  onOpen: (anchor: HTMLElement) => void;
}) {
  const cancelled = session.status === "cancelled";
  const completed = session.status === "completed";
  const unclosed = isUnclosed(session, timing);
  const look = cancelled || timing === "past" ? "muted" : timing === "today" ? "today" : "branch";
  const state = cancelled ? ", cancelled" : completed ? ", completed" : unclosed ? `, ${NOT_CLOSED_LABEL.toLowerCase()}` : timing === "today" ? ", today" : "";
  return (
    <button
      type="button"
      onClick={(e) => onOpen(e.currentTarget)}
      aria-haspopup="dialog"
      aria-expanded={expanded}
      aria-label={`${session.name}, ${dayMonth(session.session_date)}, ${formatClassTime(session.start_time)} to ${formatClassTime(session.end_time)}, ${branchName}${state}`}
      className={cn(chipVariants({ look }), look !== "muted" && tone.chip, look === "today" && tone.ring)}
    >
      <ChipContent name={session.name} time={formatClassRangeShort(session)} code={branchCode} tone={tone} muted={look === "muted"} cancelled={cancelled} completed={completed} unclosed={unclosed} />
    </button>
  );
}

// --- Popover -------------------------------------------------------------------------------

/**
 * Anchored popover on the native Popover API: it renders in the top layer (so the calendar's
 * overflow can't clip it) and light-dismisses on Escape or an outside click. It's placed below the
 * anchor (above when there's no room) and follows scrolling. Opening focuses the popover; Escape
 * returns focus to the anchor. `anchor` null hides it; `viewKey` re-places and refocuses it when
 * the content changes (day list ↔ class).
 */
export function CalendarPopover({ anchor, viewKey, labelledBy, onDismiss, children }: { anchor: HTMLElement | null; viewKey: string; labelledBy: string; onDismiss: () => void; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const latest = useRef({ anchor, onDismiss });
  useLayoutEffect(() => { latest.current = { anchor, onDismiss }; });

  // Light dismiss happens in the browser; report it so the parent clears its state. Programmatic
  // hides (anchor set to null) arrive after `latest` is cleared, so they're ignored here.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onToggle = (event: Event) => {
      const target = latest.current.anchor;
      if ((event as ToggleEvent).newState !== "closed" || !target) return;
      const active = document.activeElement;
      latest.current.onDismiss();
      if (target.isConnected && (!active || active === document.body || el.contains(active))) target.focus({ preventScroll: true });
    };
    el.addEventListener("toggle", onToggle);
    return () => el.removeEventListener("toggle", onToggle);
  }, []);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!anchor) {
      if (el.matches(":popover-open")) el.hidePopover();
      return;
    }
    if (!el.matches(":popover-open")) el.showPopover();
    const place = () => {
      if (!anchor.isConnected) return;
      const rect = anchor.getBoundingClientRect();
      const margin = 8, gap = 6;
      const width = el.offsetWidth, height = el.offsetHeight;
      const viewportWidth = document.documentElement.clientWidth, viewportHeight = window.innerHeight;
      let top = rect.bottom + gap;
      if (top + height > viewportHeight - margin && rect.top - gap - height >= margin) top = rect.top - gap - height;
      el.style.top = `${Math.max(margin, Math.min(top, viewportHeight - height - margin))}px`;
      el.style.left = `${Math.max(margin, Math.min(rect.left, viewportWidth - width - margin))}px`;
    };
    place();
    el.focus({ preventScroll: true });
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [anchor, viewKey]);

  return (
    <div
      ref={ref}
      popover="auto"
      role="dialog"
      aria-labelledby={labelledBy}
      tabIndex={-1}
      className="popover-in inset-auto m-0 max-h-[min(30rem,calc(100vh-1rem))] w-80 max-w-[calc(100vw-1rem)] overflow-y-auto overscroll-contain rounded-xl border border-border bg-white p-0 text-foreground shadow-[0_16px_40px_-12px_#071e3033,0_2px_6px_#071e3010] outline-none"
    >
      {anchor && children}
    </div>
  );
}

const CloseButton = ({ onClose }: { onClose: () => void }) => (
  <button type="button" onClick={onClose} aria-label="Close" className="grid size-8 shrink-0 place-items-center rounded-lg text-slate-500 transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-primary"><X size={16} aria-hidden /></button>
);

/** One class: when, where, who, repeat pattern, and the actions that exist today. */
export function ClassPopoverContent({ clubId, titleId, session, unclosed, branch, tone, onEdit, onDetails, onBack, onClose }: {
  clubId: string;
  titleId: string;
  session: ClassSession;
  /** Ended but still scheduled: "Mark completed" becomes the main action. */
  unclosed: boolean;
  branch?: ClassBranch;
  tone: BranchTone;
  onEdit: () => void;
  onDetails: () => void;
  /** Set when opened from a day's "+N more" list. */
  onBack?: () => void;
  onClose: () => void;
}) {
  const cancelled = session.status === "cancelled";
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ error?: string; success?: string }>({});
  // The same server action as the details dialog; the page refreshes and the chip turns plain grey.
  const markCompleted = () => startTransition(async () => setResult(await setClassStatus(clubId, session.id, "completed")));
  return (
    <div className="p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          {onBack && (
            <button type="button" onClick={onBack} className="-ml-1 mb-1.5 inline-flex items-center gap-0.5 rounded-md px-1 py-0.5 text-xs font-semibold text-primary hover:bg-primary/10 focus-visible:outline-2 focus-visible:outline-primary">
              <ChevronLeft size={14} aria-hidden /> All classes on {dayMonth(session.session_date)}
            </button>
          )}
          <h3 id={titleId} className={cn("break-words text-base! font-semibold leading-snug", cancelled && "text-slate-500 line-through")}>{session.name}</h3>
          {session.status !== "scheduled" && <Badge tone={cancelled ? "neutral" : "success"} icon={cancelled ? X : CircleCheck} className="mt-1.5">{CLASS_STATUS_LABELS[session.status] ?? session.status}</Badge>}
          {unclosed && <p className="mt-1.5 inline-flex items-center gap-1.5 text-xs font-medium text-amber-800"><NotClosedDot />{NOT_CLOSED_LABEL}</p>}
        </div>
        <CloseButton onClose={onClose} />
      </div>
      <dl className="mt-3 grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2 text-sm">
        <dt className="text-slate-500">Date</dt><dd>{fullDate(session.session_date)}</dd>
        <dt className="text-slate-500">Time</dt><dd className="tabular-nums">{formatClassRange(session)}</dd>
        <dt className="text-slate-500">Branch</dt>
        <dd className="inline-flex min-w-0 items-center gap-2"><span aria-hidden className={cn("size-2.5 shrink-0 rounded-[3px]", tone.dot)} /><span className="break-words">{branch?.name ?? "Unknown branch"}{branch?.archived_at && <span className="text-slate-500"> (archived)</span>}</span></dd>
        <dt className="text-slate-500">Coach</dt><dd className="break-words">{session.instructor_name ?? <span className="text-slate-400">Not assigned</span>}</dd>
        {session.series && (
          <>
            <dt className="text-slate-500">Repeats</dt>
            <dd className="inline-flex items-start gap-1.5"><Repeat size={14} aria-hidden className="mt-0.5 shrink-0 text-slate-500" />{describeSeries(session.series)}</dd>
          </>
        )}
      </dl>
      {/* TODO(attendance): add "Take attendance" here once attendance exists (no table, route or
          action yet). Enrolled count also needs enrolment data. */}
      {result.error && <p role="alert" className="mt-3 rounded-lg border border-red-200/70 bg-red-50 px-3 py-2 text-sm text-red-800">{result.error}</p>}
      {result.success && <p role="status" className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-emerald-800"><CircleCheck size={15} aria-hidden /> {result.success}</p>}
      <div className="mt-4 flex flex-wrap gap-2 border-t border-border pt-3" aria-busy={pending}>
        {unclosed && <Button type="button" size="sm" onClick={markCompleted} disabled={pending}><CircleCheck size={15} aria-hidden /> {pending ? "Saving…" : "Mark completed"}</Button>}
        <Button type="button" variant="outline" size="sm" onClick={onEdit} disabled={pending}><Pencil size={15} aria-hidden /> Edit</Button>
        <Button type="button" variant="ghost" size="sm" onClick={onDetails}><Eye size={15} aria-hidden /> View details</Button>
      </div>
    </div>
  );
}

/** Every class on one day (from "+N more"), in start-time order; each opens its own summary. */
export function DayPopoverContent({ titleId, day, children, onShowList, onClose }: { titleId: string; day: string; children: React.ReactNode; onShowList: () => void; onClose: () => void }) {
  return (
    <div className="p-3">
      <div className="mb-2 flex items-start justify-between gap-2 pl-1">
        <h3 id={titleId} className="pt-1 text-sm! font-semibold">{dayMonth(day)}</h3>
        <CloseButton onClose={onClose} />
      </div>
      <ul className="space-y-1">{children}</ul>
      <div className="mt-3 border-t border-border pt-2">
        <Button type="button" variant="ghost" size="sm" className="w-full justify-start" onClick={onShowList}><List size={15} aria-hidden /> Show this day in the class list</Button>
      </div>
    </div>
  );
}
