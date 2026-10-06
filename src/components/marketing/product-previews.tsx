import Image from "next/image";
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight, LayoutDashboard, MapPin, Receipt, Settings, TrendingDown, TrendingUp, Users, Wallet, type LucideIcon } from "lucide-react";
import { assets } from "@/lib/assets";
import { BRANCH_TONES, type BranchTone } from "@/lib/branch-colors";
import { BranchCodeBadge } from "@/components/branch-code-badge";
import { PreviewChip } from "@/components/marketing/preview-chip";
import { formatMYR } from "@/lib/finance/values";
import { FeeStatusPill } from "@/components/fees/fee-status-badge";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// Product previews for the public homepage. There are no screenshots in the repository, so these
// are built from the app's own pieces (fee status pill, branch code badge, calendar chip, badges,
// colour tokens) with sample data, and labelled "Sample data". They're pictures, not controls: each
// frame is one role="img" with a description, and its content is inert (no focus, no clicks).

/** The sample "today" for relative labels ("4 days late", "Due today"), so previews never drift. */
const SAMPLE_TODAY = "2026-10-05";
const BA = { code: "BA", tone: BRANCH_TONES.teal, name: "Bukit Antarabangsa" };
const TMA = { code: "TMA", tone: BRANCH_TONES.rose, name: "Taman Melawati" };
const SE = { code: "SE", tone: BRANCH_TONES.amber, name: "Setapak" };

/** App-window frame: a slim title bar with the Ranting mark and a "Sample data" tag. */
export function PreviewFrame({ label, className, children }: { label: string; className?: string; children: React.ReactNode }) {
  return (
    <div role="img" aria-label={label} className={cn("overflow-hidden rounded-2xl border border-border bg-background shadow-[0_24px_60px_-28px_#071e3040]", className)}>
      <div className="flex items-center justify-between gap-3 border-b border-border bg-white px-4 py-2.5">
        <span className="flex items-center gap-2">
          <Image src={assets.icon} alt="" className="size-5" />
          <span className="text-xs font-semibold text-slate-700">Ranting</span>
        </span>
        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600">Sample data</span>
      </div>
      <div inert className="pointer-events-none select-none">{children}</div>
    </div>
  );
}

const Card = ({ title, aside, children, className }: { title: string; aside?: React.ReactNode; children: React.ReactNode; className?: string }) => (
  <div className={cn("rounded-xl border border-border bg-white p-3.5", className)}>
    <div className="mb-2.5 flex items-center justify-between gap-2">
      <span className="text-xs font-bold text-foreground">{title}</span>
      {aside}
    </div>
    {children}
  </div>
);

function MiniStat({ label, value, note, icon: Icon, tone = "default" }: { label: string; value: string; note?: string; icon: LucideIcon; tone?: "default" | "positive" | "warning" | "featured" }) {
  const featured = tone === "featured";
  return (
    <div className={cn("min-w-0 rounded-xl border p-3", featured ? "border-navy bg-navy text-white" : "border-border bg-white")}>
      <div className="flex items-center justify-between gap-2">
        <span className={cn("truncate text-[11px] font-medium", featured ? "text-white/70" : "text-slate-600")}>{label}</span>
        <span className={cn("grid size-6 shrink-0 place-items-center rounded-md", featured ? "bg-white/10 text-white" : tone === "positive" ? "bg-primary/10 text-primary" : tone === "warning" ? "bg-amber-50 text-amber-700" : "bg-muted text-foreground")}>
          <Icon size={12} strokeWidth={1.75} aria-hidden />
        </span>
      </div>
      <div className="mt-2 truncate text-[0.9375rem] font-semibold tabular-nums tracking-[-0.02em] sm:text-base">{value}</div>
      {note && <div className={cn("mt-0.5 truncate text-[10px]", featured ? "text-white/60" : "text-slate-500")}>{note}</div>}
    </div>
  );
}

const Initials = ({ name }: { name: string }) => (
  <span className="grid size-7 shrink-0 place-items-center rounded-full bg-muted text-[10px] font-semibold text-slate-700">
    {name.split(" ").slice(0, 2).map((w) => w[0]).join("")}
  </span>
);

const Chip = ({ name, time, branch, look }: { name: string; time: string; branch: { code: string; tone: BranchTone }; look?: "branch" | "today" | "muted" }) => (
  <PreviewChip name={name} time={time} code={branch.code} tone={branch.tone} look={look} />
);

const NAV: LucideIcon[] = [LayoutDashboard, MapPin, Users, CalendarDays, Receipt, Wallet, Settings];

/** Hero: the club Dashboard inside the app shell (navy sidebar, summary cards, registrations, today's classes). */
export function DashboardPreview() {
  return (
    <PreviewFrame label="Preview of the Ranting dashboard with sample data: student count, income, expenses and net cash flow for the month, pending parent registrations and today's classes.">
      <div className="flex">
        <div className="hidden w-12 shrink-0 flex-col items-center gap-1.5 bg-navy py-4 sm:flex">
          {NAV.map((Icon, i) => (
            <span key={i} className={cn("grid size-8 place-items-center rounded-lg", i === 0 ? "bg-white text-navy" : "text-white/55")}>
              <Icon size={15} strokeWidth={1.75} aria-hidden />
            </span>
          ))}
        </div>
        <div className="min-w-0 flex-1 p-4 sm:p-5">
          <div className="flex items-center gap-3">
            <span className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-xl bg-white ring-1 ring-inset ring-black/[0.06]">
              <Image src={assets.club} alt="" className="size-full object-cover" />
            </span>
            <div className="min-w-0">
              <div className="text-lg font-bold leading-tight tracking-[-0.03em]">Dashboard</div>
              <div className="truncate text-[11px] text-slate-600">Seni Silat Gombak · Silat</div>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2.5">
            <MiniStat label="Students" value="128" note="6 joined this month" icon={Users} />
            <MiniStat label="Income · October" value="RM4,820.00" note="Fees and other income" icon={TrendingUp} tone="positive" />
            <MiniStat label="Expenses · October" value="RM1,350.00" note="Rent, equipment, events" icon={TrendingDown} tone="warning" />
            <MiniStat label="Net cash flow" value="RM3,470.00" note="Income minus expenses" icon={Wallet} tone="featured" />
          </div>
          <div className="mt-2.5 grid gap-2.5 sm:grid-cols-2">
            <Card title="Pending registrations" aside={<Badge tone="warning" className="px-2 py-0 text-[10px]">2 new</Badge>}>
              <ul className="space-y-2">
                {[{ name: "Aisyah Rahman", branch: TMA }, { name: "Daniel Lim", branch: BA }].map(({ name, branch }) => (
                  <li key={name} className="flex items-center gap-2">
                    <Initials name={name} />
                    <span className="min-w-0 flex-1 truncate text-xs font-medium">{name}</span>
                    <BranchCodeBadge code={branch.code} tone={branch.tone} />
                  </li>
                ))}
              </ul>
            </Card>
            <Card title="Today's classes">
              <div className="space-y-1.5">
                <Chip name="Junior Kids" time="5–6:30 PM" branch={SE} look="today" />
                <Chip name="Silibus Asas" time="8:30–10:30 PM" branch={BA} />
              </div>
            </Card>
          </div>
        </div>
      </div>
    </PreviewFrame>
  );
}

/** Showcase: recent club activity (transactions and new students) from the Dashboard. */
export function ActivityPreview() {
  const rows: [string, string, string, typeof BA, boolean][] = [
    ["Monthly fee · Aisyah Rahman", "Monthly fees", "+RM80.00", TMA, true],
    ["Hall rental", "Rent", "−RM450.00", BA, false],
    ["Tournament entry · 6 students", "Events", "+RM300.00", SE, true],
    ["Uniforms (10)", "Equipment", "−RM380.00", BA, false],
  ];
  return (
    <PreviewFrame label="Preview of recent club activity with sample data: income and expense transactions by branch and recently added students.">
      <div className="grid gap-2.5 p-4 sm:p-5">
        <Card title="Recent transactions" aside={<span className="text-[10px] text-slate-500">This month</span>}>
          <ul className="divide-y divide-border">
            {rows.map(([label, category, amount, branch, income]) => (
              <li key={label} className="flex items-center gap-2.5 py-2 first:pt-0 last:pb-0">
                <span className={cn("grid size-7 shrink-0 place-items-center rounded-lg", income ? "bg-primary/10 text-primary" : "bg-amber-50 text-amber-700")}>
                  {income ? <TrendingUp size={13} aria-hidden /> : <TrendingDown size={13} aria-hidden />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-medium">{label}</span>
                  <span className="mt-0.5 flex items-center gap-1.5 text-[10px] text-slate-500"><BranchCodeBadge code={branch.code} tone={branch.tone} />{category}</span>
                </span>
                <span className={cn("shrink-0 text-xs font-semibold tabular-nums", income ? "text-emerald-700" : "text-foreground")}>{amount}</span>
              </li>
            ))}
          </ul>
        </Card>
        <Card title="Recent students">
          <ul className="flex flex-wrap gap-x-4 gap-y-2">
            {["Nurul Izzah", "Tan Wei Ming", "Arjun Pillai"].map((name) => (
              <li key={name} className="flex items-center gap-2 text-xs font-medium"><Initials name={name} />{name}</li>
            ))}
          </ul>
        </Card>
      </div>
    </PreviewFrame>
  );
}

/** Showcase: the Fees list (status with relative due date, balance, partly-paid progress). */
export function FeesPreview() {
  const fees = [
    { student: "Aisyah Rahman", branch: TMA, fee: "Monthly fee · Oct 2026", due: "2026-10-01", amount: 8000, paid: 0, status: "unpaid" },
    { student: "Muhammad Haziq", branch: BA, fee: "Monthly fee · Oct 2026", due: "2026-10-05", amount: 8000, paid: 3000, status: "partial" },
    { student: "Tan Wei Ming", branch: SE, fee: "Annual membership · 2026", due: "2026-10-12", amount: 12000, paid: 0, status: "unpaid" },
    { student: "Siti Khadijah", branch: BA, fee: "Uniform (size M)", due: "2026-10-01", amount: 6500, paid: 6500, status: "paid" },
  ];
  const rm = (sen: number) => formatMYR(sen);
  return (
    <PreviewFrame label="Preview of the Fees list with sample data: each student's fee, its status such as 4 days late, due today or paid, and the remaining balance.">
      <div className="p-4 sm:p-5">
        <div className="mb-3 grid grid-cols-2 gap-2.5">
          <MiniStat label="Outstanding" value="RM578.00" note="Remaining balances" icon={Receipt} tone="featured" />
          <MiniStat label="Overdue" value="RM280.00" note="Due before today" icon={TrendingDown} tone="warning" />
        </div>
        <div className="overflow-hidden rounded-xl border border-border bg-white">
          {fees.map((f) => {
            const balance = f.amount - f.paid;
            return (
              <div key={f.student} className="flex items-center gap-3 border-b border-border px-3.5 py-2.5 last:border-b-0">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-xs font-medium">{f.student}</div>
                  <div className="mt-0.5 flex min-w-0 items-center gap-1.5 text-[10px] text-slate-500"><BranchCodeBadge code={f.branch.code} tone={f.branch.tone} /><span className="truncate">{f.fee}</span></div>
                </div>
                <FeeStatusPill fee={{ status: f.status, balance_sen: balance, due_date: f.due }} today={SAMPLE_TODAY} className="hidden px-2 text-[10px] min-[420px]:inline-flex" />
                <div className="w-20 shrink-0 text-right">
                  {balance <= 0 ? <span className="text-xs text-slate-500">Paid</span> : <>
                    <div className="text-xs font-semibold tabular-nums">{rm(balance)}</div>
                    {f.paid > 0
                      ? <span className="ml-auto mt-1 block h-[3px] w-14 overflow-hidden rounded-full bg-slate-200"><span className="block h-full rounded-full bg-emerald-600" style={{ width: `${Math.floor((f.paid * 100) / f.amount)}%` }} /></span>
                      : <div className="text-[10px] tabular-nums text-slate-500">of {rm(f.amount)}</div>}
                  </>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </PreviewFrame>
  );
}

// --- Classes: a cropped window of the month calendar ----------------------------------------

type SampleClass = { name: string; time: string; branch: typeof BA; state?: "completed" | "unclosed" };
const SB = { code: "SB", tone: BRANCH_TONES.violet, name: "Sri Bintang" };
const silibus: SampleClass = { name: "Silibus", time: "9–11 AM", branch: BA };
const sparring: SampleClass = { name: "Sparring", time: "8–10 PM", branch: BA };
const olahRaga: SampleClass = { name: "Olah Raga", time: "10 AM–12 PM", branch: BA };
const conditioning: SampleClass = { name: "Conditioning", time: "8–9 AM", branch: SB };
const junior: SampleClass = { name: "Junior Class", time: "9–11 AM", branch: SB };
const senior: SampleClass = { name: "Senior Class", time: "8–10 PM", branch: SB };
const grading: SampleClass = { name: "Grading Preparation", time: "9–11 AM", branch: BA };

/**
 * Three October weeks, Wednesday (only its edge shows) to Sunday; "today" is Thursday 8 October.
 * Before today: completed classes and one not marked completed; from today: upcoming classes.
 */
const CROP_DAYS = ["Wed", "Thu", "Fri", "Sat", "Sun"];
const CROP_WEEKS: { date: number; inMonth?: boolean; classes: SampleClass[] }[][] = [
  [{ date: 30, inMonth: false, classes: [] }, { date: 1, classes: [{ ...sparring, state: "completed" }] }, { date: 2, classes: [{ ...silibus, state: "unclosed" }] }, { date: 3, classes: [{ ...olahRaga, state: "completed" }] }, { date: 4, classes: [{ ...conditioning, state: "completed" }] }],
  [{ date: 7, classes: [{ ...senior, state: "completed" }] }, { date: 8, classes: [sparring] }, { date: 9, classes: [silibus] }, { date: 10, classes: [junior] }, { date: 11, classes: [] }],
  [{ date: 14, classes: [] }, { date: 15, classes: [conditioning, sparring] }, { date: 16, classes: [silibus] }, { date: 17, classes: [grading] }, { date: 18, classes: [conditioning] }],
];
const CROP_TODAY = { week: 1, col: 1 };
const isPastCell = (week: number, col: number) => week < CROP_TODAY.week || (week === CROP_TODAY.week && col < CROP_TODAY.col);

// Columns by preview width (container queries): Thu–Sat when narrow, Thu–Sun from 28rem, and with the
// cropped edge of Wednesday from 30rem. Each day column stays wide enough for readable chips.
const CROP_GRID = "grid grid-cols-3 @md:grid-cols-4 @[30rem]:grid-cols-[0.45fr_repeat(4,minmax(0,1fr))]";
const cropCell = (col: number) => (col === 0 ? "hidden @[30rem]:flex justify-end overflow-hidden" : col === 4 ? "hidden @md:block" : "");

const MiniSelect = ({ value, className }: { value: string; className?: string }) => (
  <span className={cn("h-7 items-center gap-1.5 rounded-lg border border-border bg-white px-2 text-[11px] text-foreground", className)}>
    {value}<ChevronDown size={12} aria-hidden className="text-slate-500" />
  </span>
);

/**
 * Showcase: a deliberately cropped window of the Classes calendar (not the whole month), sized like
 * the other previews. Compact toolbar and branch legend, abbreviated weekdays, about two and a half
 * weeks inside a fixed-height window, and the app's real chips (branch code badges, completed tick,
 * amber "not marked completed" dot, today's ring).
 */
export function ClassesPreview() {
  return (
    <PreviewFrame label="Preview of the Ranting Classes calendar with sample data: part of October 2026 with classes such as Sparring, Silibus, Olah Raga, Junior Class, Conditioning and Grading Preparation at two branches, BA and SB, showing completed, not marked completed and upcoming classes.">
      <div className="@container p-4 sm:p-5">
        <div className="overflow-hidden rounded-xl border border-border bg-white">
          <div className="flex items-start justify-between gap-3 border-b border-border px-3.5 py-3">
            <div className="min-w-0">
              <div className="text-sm font-bold tracking-[-0.02em]">October 2026</div>
              <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-slate-600">
                {[BA, SB].map((b) => <span key={b.code} className="inline-flex items-center gap-1"><span aria-hidden className={cn("size-2 rounded-[3px]", b.tone.dot)} />{b.name}</span>)}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <MiniSelect value="October" className="hidden @[30rem]:inline-flex" />
              <MiniSelect value="2026" className="hidden @[30rem]:inline-flex" />
              <span className="inline-flex h-7 items-center rounded-lg border border-border bg-white px-2.5 text-[11px] font-semibold">Today</span>
              <span className="grid size-7 place-items-center rounded-lg border border-border bg-white"><ChevronLeft size={13} aria-hidden /></span>
              <span className="grid size-7 place-items-center rounded-lg border border-border bg-white"><ChevronRight size={13} aria-hidden /></span>
            </div>
          </div>

          <div className={cn(CROP_GRID, "border-b border-border bg-slate-50/80")}>
            {CROP_DAYS.map((d, col) => (
              <div key={d} className={cn("px-2 py-1.5 text-[11px] font-semibold text-slate-500", cropCell(col))}><span className={cn(col === 0 && "w-12 shrink-0")}>{d}</span></div>
            ))}
          </div>
          {/* Fixed-height window: the third week is cut off on purpose, like a cropped screenshot. */}
          <div className="max-h-56 overflow-hidden">
            {CROP_WEEKS.map((week, w) => (
              <div key={w} className={cn(CROP_GRID, "border-b border-border")}>
                {week.map((cell, col) => {
                  const today = w === CROP_TODAY.week && col === CROP_TODAY.col;
                  const inMonth = cell.inMonth !== false;
                  const content = (
                    <>
                      <span className={cn("grid size-5 place-items-center rounded-full text-[11px] tabular-nums", !inMonth && "text-slate-400", today && "bg-navy font-bold text-white")}>{cell.date}</span>
                      {cell.classes.length > 0 && (
                        <div className="mt-1 space-y-1">
                          {cell.classes.map((c, i) => (
                            <PreviewChip key={i} name={c.name} time={c.time} code={c.branch.code} tone={c.branch.tone}
                              look={isPastCell(w, col) ? "muted" : today ? "today" : "branch"} completed={c.state === "completed"} unclosed={c.state === "unclosed"} />
                          ))}
                        </div>
                      )}
                    </>
                  );
                  return (
                    <div key={col} className={cn("min-h-[4.75rem] min-w-0 border-r border-border p-1.5 last:border-r-0", !inMonth && "bg-muted/60", cropCell(col))}>
                      {/* The Wednesday edge renders a normal-width column, right-aligned, so only its right side shows. */}
                      {col === 0 ? <div className="w-28 shrink-0">{content}</div> : content}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    </PreviewFrame>
  );
}

/** Showcase: Finance summary and income by category. */
export function FinancePreview() {
  const categories: [string, string, number][] = [["Monthly fees", "RM3,480.00", 72], ["Registration", "RM680.00", 14], ["Events", "RM420.00", 9], ["Uniforms", "RM240.00", 5]];
  return (
    <PreviewFrame label="Preview of Finance with sample data: income, expenses and net cash flow for the month, and income broken down by category.">
      <div className="p-4 sm:p-5">
        <div className="grid grid-cols-3 gap-2.5">
          <MiniStat label="Income" value="RM4,820" icon={TrendingUp} tone="positive" />
          <MiniStat label="Expenses" value="RM1,350" icon={TrendingDown} tone="warning" />
          <MiniStat label="Net" value="RM3,470" icon={Wallet} tone="featured" />
        </div>
        <Card title="Income by category" className="mt-2.5" aside={<span className="text-[10px] text-slate-500">October 2026</span>}>
          <ul className="space-y-2.5">
            {categories.map(([name, amount, pct]) => (
              <li key={name}>
                <div className="flex items-baseline justify-between gap-2 text-xs"><span className="font-medium">{name}</span><span className="tabular-nums text-slate-600">{amount} · {pct}%</span></div>
                <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-muted"><span className="block h-full rounded-full bg-primary" style={{ width: `${pct}%` }} /></span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </PreviewFrame>
  );
}
