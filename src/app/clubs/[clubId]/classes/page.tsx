import { requireClub } from "@/lib/clubs";
import { branchScope } from "@/lib/finance/queries";
import { listClassSessions } from "@/lib/classes";
import { idSchema, pageNumber, todayInMalaysia } from "@/lib/validation";
import { malaysiaTimeNow } from "@/lib/classes-shared";
import { PageHeader } from "@/components/page-header";
import { Notice } from "@/components/notice";
import { ClassBranchFilter } from "@/components/classes/class-branch-filter";
import { AddClassDialog } from "@/components/classes/class-form";
import { ClassesWorkspace } from "@/components/classes/classes-workspace";
import { createClass } from "./actions";

export const metadata = { title: "Classes" };
const notices = { created: "Class added.", series: "Weekly class added. Its classes are on the calendar and can each be edited or cancelled.", updated: "Class updated." };

/** A real calendar date (YYYY-MM-DD) within the range the database accepts. */
function validDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value) && value > "1900-01-01" && value < "2200-01-01";
}
const validMonth = (value: unknown): value is string => typeof value === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(value) && value >= "1900-02" && value <= "2199-12";

export default async function Classes({ params, searchParams }: PageProps<"/clubs/[clubId]/classes">) {
  const { clubId } = await params;
  const sp = await searchParams;
  // Malaysia calendar: "today", the default month and the selected day are Asia/Kuala_Lumpur dates.
  const today = todayInMalaysia();
  const date = validDate(sp.date) ? sp.date : "";
  // A selected day always shows its own month; changing month drops the day (links omit `date`).
  const month = date ? date.slice(0, 7) : validMonth(sp.month) ? sp.month : today.slice(0, 7);
  const page = pageNumber(sp.page);
  // branchScope 404s on a malformed or foreign branch; the session query only ever gets a valid uuid.
  const branchParam = typeof sp.branch === "string" && idSchema.safeParse(sp.branch).success ? sp.branch : "";

  // Membership check, branch options and the visible month's sessions: one parallel round trip.
  const [{ club }, scope, { sessions, limited }] = await Promise.all([requireClub(clubId), branchScope(clubId, sp.branch), listClassSessions(clubId, month, branchParam)]);
  const base = `/clubs/${club.id}/classes`;
  const activeBranches = scope.options.filter((b) => !b.archived_at);
  // New classes default to the filtered branch (if current) and the selected day (or today).
  const initialBranchId = scope.selected && !scope.selected.archived_at ? scope.selected.id : activeBranches.length === 1 ? activeBranches[0].id : "";

  return (
    <>
      <PageHeader
        title="Classes"
        description="Manage your club's training schedule."
        actions={
          <div className="flex w-full flex-wrap items-end gap-2.5 sm:w-auto">
            <ClassBranchFilter base={base} month={month} date={date} selected={scope.id} branches={scope.options} />
            <AddClassDialog clubId={club.id} branches={activeBranches} initialBranchId={initialBranchId} initialDate={date || (today.startsWith(month) ? today : `${month}-01`)} currentBranch={scope.id} />
          </div>
        }
      />
      <Notice code={sp.notice} messages={notices} />
      <ClassesWorkspace
        clubId={club.id}
        base={base}
        today={today}
        now={malaysiaTimeNow()}
        month={month}
        date={date}
        branch={scope.id}
        page={page}
        sessions={sessions}
        limited={limited}
        branches={scope.options}
        activeBranches={activeBranches}
      />
    </>
  );
}
