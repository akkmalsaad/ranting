import Link from "next/link";
import { ArrowDownLeft, ArrowUpRight, Check, ChevronDown, Circle, Scale, Users } from "lucide-react";
import { clubClient, requireClub, type Club } from "@/lib/clubs";
import { branchScope, financeSummary } from "@/lib/finance/queries";
import { categoryLabel, formatMYR, formatSignedMYR } from "@/lib/finance/values";
import { formatDate } from "@/lib/format";
import { APPLICATION_COLUMNS, duplicateNotes, siblingsBySubmission } from "@/lib/registrations";
import { todayInMalaysia } from "@/lib/validation";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { SectionCard, SectionLink, SectionMessage } from "@/components/section-card";
import { InitialsAvatar } from "@/components/initials-avatar";
import { Notice } from "@/components/notice";
import { Modal } from "@/components/ui/modal";
import { ClubProfileForm, EditClubProfileDialog } from "@/components/clubs/club-profile-form";
import { ClubLogoTile, clubLogoSrc } from "@/components/clubs/club-logo";
import { profileChecklist } from "@/components/clubs/profile-completion";
import { DashboardBranchFilter } from "@/components/clubs/dashboard-branch-filter";
import { listBeltLevels } from "@/lib/belt-levels";
import { AddStudentMenu } from "@/components/students/add-student-menu";
import { StatusBadge } from "@/components/students/status-badge";
import { AddTransactionDialog } from "@/components/finance/transaction-form";
import { PendingRegistrations } from "@/components/registrations/pending-registrations";
import { completeClubProfile, saveClubProfile } from "./settings/actions";
import { addStudents } from "./students/actions";
import { addTransaction } from "./finances/actions";
import { loadClubCategories } from "@/lib/club-settings";

export const metadata = { title: "Dashboard" };

const RECENT = 5;
const notices = {
  profile: "Club profile saved.",
  created: "Student added.",
  recorded: "Transaction recorded.",
  approved: "Registration approved. The student has been added.",
  rejected: "Registration rejected.",
};

type Transaction = { id: string; kind: "income" | "expense"; description: string; category: string | null; occurred_on: string; amount_sen: number; created_at: string };

export default async function Dashboard({ params, searchParams }: PageProps<"/clubs/[clubId]">) {
  const { clubId } = await params;
  const sp = await searchParams;
  const welcome = sp.welcome === "1";
  const { db } = await clubClient(clubId);
  const [{ club }, scope] = await Promise.all([requireClub(clubId), branchScope(clubId, sp.branch)]);

  // Every figure follows the selected branch; with a branch selected, club-level records
  // (no branch) are excluded, as elsewhere in the app. Branch count always covers the club.
  let studentCount = db.from("students").select("id", { count: "exact", head: true }).eq("club_id", clubId).is("archived_at", null);
  let recentStudents = db.from("students").select("id, full_name, status, archived_at, branch_id, join_date").eq("club_id", clubId).is("archived_at", null);
  let recentIncome = db.from("payments_received").select("id, description, category, occurred_on, amount_sen, created_at").eq("club_id", clubId);
  let recentExpenses = db.from("expenses").select("id, description, category, occurred_on, amount_sen, created_at").eq("club_id", clubId);
  let pendingCount = db.from("student_applications").select("id", { count: "exact", head: true }).eq("club_id", clubId).eq("status", "pending");
  let pendingList = db.from("student_applications").select(APPLICATION_COLUMNS).eq("club_id", clubId).eq("status", "pending");
  if (scope.id) {
    studentCount = studentCount.eq("branch_id", scope.id);
    recentStudents = recentStudents.eq("branch_id", scope.id);
    recentIncome = recentIncome.eq("branch_id", scope.id);
    recentExpenses = recentExpenses.eq("branch_id", scope.id);
    pendingCount = pendingCount.eq("requested_branch_id", scope.id);
    pendingList = pendingList.eq("requested_branch_id", scope.id);
  }
  const [branches, students, recent, income, expenses, finance, pendingTotal, pending, beltLevels, { categories }] = await Promise.all([
    db.from("branches").select("id", { count: "exact", head: true }).eq("club_id", clubId).is("archived_at", null),
    studentCount,
    recentStudents.order("created_at", { ascending: false }).order("id").limit(RECENT),
    recentIncome.order("occurred_on", { ascending: false }).order("created_at", { ascending: false }).limit(RECENT),
    recentExpenses.order("occurred_on", { ascending: false }).order("created_at", { ascending: false }).limit(RECENT),
    financeSummary(clubId, scope.id),
    pendingCount,
    pendingList.order("submitted_at", { ascending: true }).order("id").limit(RECENT),
    listBeltLevels(db, clubId),
    loadClubCategories(clubId),
  ]);
  const [duplicates, siblings] = pending.data?.length
    ? await Promise.all([duplicateNotes(db, club.id, pending.data), siblingsBySubmission(db, club.id, pending.data)])
    : [{}, {}];

  const base = `/clubs/${club.id}`;
  const branchQuery = scope.id ? `branch=${scope.id}` : "";
  const withBranch = (path: string, query = "") => { const qs = [query, branchQuery].filter(Boolean).join("&"); return qs ? `${path}?${qs}` : path; };
  const today = todayInMalaysia();
  const activeBranches = scope.options.filter((b) => !b.archived_at).map((b) => ({ id: b.id, name: b.name, archived: false }));
  const addBranchId = scope.selected && !scope.selected.archived_at ? scope.id : "";
  const branchName = (id: string | null) => (id ? scope.options.find((b) => b.id === id)?.name ?? "Branch" : "No branch");

  const net = finance.totals ? BigInt(finance.totals.income_sen) - BigInt(finance.totals.expense_sen) : null;
  const financeError = finance.state === "error";
  const cards = [
    { label: "Total students", value: students.error || students.count === null ? "—" : String(students.count), note: students.error ? "Unable to load" : "Active and inactive", href: withBranch(`${base}/students`), icon: Users, tone: "default" as const },
    { label: "Income this month", value: finance.totals ? formatMYR(finance.totals.income_sen) : "—", note: financeError ? "Unable to load" : "Payments received", href: withBranch(`${base}/finances`, "kind=income"), icon: ArrowDownLeft, tone: "positive" as const },
    { label: "Expenses this month", value: finance.totals ? formatMYR(finance.totals.expense_sen) : "—", note: financeError ? "Unable to load" : "Payments made", href: withBranch(`${base}/finances`, "kind=expense"), icon: ArrowUpRight, tone: "default" as const },
    { label: "Net cash flow", value: net === null ? "—" : formatSignedMYR(net), note: financeError ? "Unable to load" : "Income − expenses", href: withBranch(`${base}/finances`), icon: Scale, tone: "featured" as const },
  ];

  const transactions: Transaction[] = [
    ...(income.data ?? []).map((t) => ({ ...t, kind: "income" as const })),
    ...(expenses.data ?? []).map((t) => ({ ...t, kind: "expense" as const })),
  ].sort((a, b) => b.occurred_on.localeCompare(a.occurred_on) || b.created_at.localeCompare(a.created_at)).slice(0, RECENT);

  const createdCount = Number(sp.count);
  const createdMany = Number.isInteger(createdCount) && createdCount >= 2 && createdCount <= 50 ? `${createdCount} students added.` : "Students added.";

  return <>
    <PageHeader
      title="Dashboard"
      description={`${club.name} · ${club.discipline}`}
      leading={<ClubLogoTile club={club} className="size-12 sm:size-16 sm:rounded-2xl" />}
      actions={<DashboardBranchFilter base={base} selected={scope.id} branches={scope.options} branchCount={branches.error ? null : branches.count} />}
    />
    <Notice code={sp.notice} messages={{ ...notices, "created-many": createdMany }} />

    {/* Quick actions (existing modals) */}
    <div className="mb-8 flex flex-wrap gap-2.5">
      <AddStudentMenu clubId={club.id} align="left" beltLevels={beltLevels} settingsHref={`${base}/settings`} action={addStudents.bind(null, club.id)} clubName={club.name} today={today} branches={activeBranches} initialBranchId={addBranchId || undefined} />
      <AddTransactionDialog action={addTransaction.bind(null, club.id)} clubName={club.name} kind="income" today={today} branchId={addBranchId} branches={activeBranches} categories={categories} variant="outline" />
      <AddTransactionDialog action={addTransaction.bind(null, club.id)} clubName={club.name} kind="expense" today={today} branchId={addBranchId} branches={activeBranches} categories={categories} variant="outline" />
    </div>

    {/* Summary */}
    <section aria-labelledby="summary-title">
      <div className="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 id="summary-title" className="text-[1.0625rem]! font-semibold! tracking-[-0.015em]!">{finance.month.label}</h2>
        <p className="text-[0.8125rem] text-slate-500">Malaysia time{scope.selected ? ` · ${scope.selected.name}${scope.selected.archived_at ? " (archived)" : ""}, excluding club-level records` : ""}</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => <StatCard key={card.label} {...card} />)}
      </div>
    </section>

    {!welcome && <ProfileChecklist club={club} />}

    {/* Needs attention, then recent activity */}
    <div className="mt-6 grid items-start gap-6 xl:grid-cols-2">
      <PendingRegistrations clubId={club.id} count={pendingTotal.count ?? 0} applications={pending.data ?? []} duplicates={duplicates} siblings={siblings} beltLevels={beltLevels} branches={scope.options} viewAllHref={withBranch(`${base}/registrations`)} failed={!!(pendingTotal.error || pending.error)} />

      <SectionCard id="recent-students" title="Recent students" description="Newest first" action={<SectionLink href={withBranch(`${base}/students`)}>View all students</SectionLink>}>
        {recent.error ? <SectionMessage alert>Unable to load recent students. Reload to try again.</SectionMessage>
          : !recent.data.length ? <SectionMessage>{scope.id ? "No current students in this branch yet." : "No students yet. Use Add student to register your first student."}</SectionMessage>
          : <ul className="divide-y divide-border">{recent.data.map((s) => (
            <li key={s.id} className="group relative flex items-center gap-3 py-3.5">
              <InitialsAvatar name={s.full_name} />
              <span className="min-w-0 flex-1">
                {/* Stretched link: the whole row opens the student. */}
                <Link href={`${base}/students/${s.id}`} className="block truncate text-[0.9375rem] font-semibold after:absolute after:inset-0 after:content-[''] group-hover:text-primary group-hover:underline">{s.full_name}</Link>
                <span className="mt-0.5 block truncate text-[0.8125rem] text-slate-500">{branchName(s.branch_id)} · Joined {formatDate(s.join_date)}</span>
              </span>
              <StatusBadge status={s.status} archived={!!s.archived_at} />
            </li>
          ))}</ul>}
      </SectionCard>
    </div>

    <SectionCard id="recent-transactions" title="Recent transactions" className="mt-6" action={<SectionLink href={withBranch(`${base}/finances`)}>View all transactions</SectionLink>}>
      {income.error || expenses.error ? <SectionMessage alert>Unable to load recent transactions. Reload to try again.</SectionMessage>
        : !transactions.length ? <SectionMessage>{scope.id ? "No transactions recorded for this branch yet." : "No transactions recorded yet."}</SectionMessage>
        : <ul className="divide-y divide-border">{transactions.map((t) => {
          const Icon = t.kind === "income" ? ArrowDownLeft : ArrowUpRight;
          return (
            <li key={`${t.kind}-${t.id}`} className="flex items-center gap-3 py-3.5">
              <span aria-hidden className={`grid size-9 shrink-0 place-items-center rounded-full ${t.kind === "income" ? "bg-primary/10 text-primary" : "bg-muted text-slate-600"}`}><Icon size={16} strokeWidth={1.75} /></span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[0.9375rem] font-semibold">{t.description}</span>
                <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.8125rem] text-slate-500">
                  <span className={`font-semibold ${t.kind === "income" ? "text-primary" : "text-slate-700"}`}>{t.kind === "income" ? "Income" : "Expense"}</span>
                  <span aria-hidden>·</span>
                  <span>{categoryLabel(t.kind, t.category, categories)}</span>
                  <span aria-hidden>·</span>
                  <span>{formatDate(t.occurred_on)}</span>
                </span>
              </span>
              <span className={`shrink-0 text-[0.9375rem] font-semibold tabular-nums ${t.kind === "income" ? "text-primary" : "text-foreground"}`}>
                {t.kind === "income" ? "+" : "−"}{formatMYR(t.amount_sen)}
              </span>
            </li>
          );
        })}</ul>}
    </SectionCard>

    {welcome && <Modal labelledBy="profile-title"><p className="text-xs font-semibold text-primary">Step 2 of 2 · Optional</p><h1 id="profile-title" className="mt-1.5 text-[1.375rem]! leading-tight tracking-[-0.025em]! sm:text-2xl!">Add your club details</h1><p className="mb-6 mt-1.5 text-sm leading-6 text-slate-600">Registration, address and contact details help parents and associations recognise your club. You can add or change these later in Settings.</p><ClubProfileForm action={completeClubProfile.bind(null, club.id)} skipHref={base} /></Modal>}
  </>;
}

/** Optional club-profile checklist as a compact collapsible banner (same completion logic as before). */
function ProfileChecklist({ club }: { club: Club }) {
  const items = profileChecklist(club);
  if (items.every((i) => i.done)) return null;
  const completed = items.filter((i) => i.done).length;
  return (
    <div className="mt-6 flex items-start justify-between gap-3 rounded-2xl border border-border bg-white px-5 py-3.5 text-sm sm:px-6">
      <details className="group min-w-0 flex-1">
        <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-3 gap-y-1 py-2 [&::-webkit-details-marker]:hidden">
          <ChevronDown size={16} aria-hidden className="shrink-0 text-slate-500 transition-transform group-open:rotate-180 motion-reduce:transition-none" />
          <span className="font-semibold">Complete your club profile</span>
          <span className="flex items-center gap-2 text-slate-500">
            <span aria-hidden className="hidden h-1.5 w-20 overflow-hidden rounded-full bg-muted sm:block"><span className="block h-full rounded-full bg-primary" style={{ width: `${(completed / items.length) * 100}%` }} /></span>
            {completed}/{items.length} · Optional
          </span>
        </summary>
        <ul className="mt-2 flex flex-wrap gap-x-5 gap-y-2 pb-2 pl-7">
          {items.map(({ label, done }) => <li key={label} className="flex items-center gap-1.5 text-xs text-slate-600">{done ? <Check size={14} aria-hidden className="text-primary" /> : <Circle size={12} aria-hidden />}<span>{label}<span className="sr-only">{done ? ": complete" : ": missing"}</span></span></li>)}
        </ul>
      </details>
      {/* Opens the onboarding profile form (prefilled) in a modal; outside <summary> so it doesn't toggle the banner. */}
      <EditClubProfileDialog action={saveClubProfile.bind(null, club.id)} club={club} logoSrc={clubLogoSrc(club)} />
    </div>
  );
}
