import Link from "next/link";
import { assets } from "@/lib/assets";
import { clubClient, requireClub } from "@/lib/clubs";
import { formatDate } from "@/lib/format";
import { describeBelt, idSchema, pageNumber, searchTerm, todayInMalaysia } from "@/lib/validation";
import { Button, buttonVariants } from "@/components/ui/button";
import { SearchInput } from "@/components/ui/input";
import { EmptyState } from "@/components/empty-state";
import { Pagination } from "@/components/pagination";
import { InitialsAvatar } from "@/components/initials-avatar";
import { PageHeader } from "@/components/page-header";
import { ViewTabs } from "@/components/view-tabs";
import { Notice } from "@/components/notice";
import { listBeltLevels } from "@/lib/belt-levels";
import { AddStudentMenu } from "@/components/students/add-student-menu";
import { EditStudentDialog, StudentEditProvider } from "@/components/students/edit-student-dialog";
import { StatusBadge } from "@/components/students/status-badge";
import { BeltSwatch } from "@/components/belt-swatch";
import type { BeltLevel } from "@/lib/belt-levels";
import { addStudents } from "./actions";

export const metadata = { title: "Students" };
const PAGE_SIZE = 25;
const notices = { created: "Student added.", updated: "Student updated.", archived: "Student archived.", restored: "Student restored." };
const views = ["all", "active", "inactive", "archived"] as const;
type View = (typeof views)[number];

export default async function Students({ params, searchParams }: PageProps<"/clubs/[clubId]/students">) {
  const { clubId } = await params;
  const sp = await searchParams;
  const { db } = await clubClient(clubId);
  const view: View = views.find((v) => v === sp.view) ?? "all";
  const q = searchTerm(sp.q);
  const branch = sp.branch === "none" || idSchema.safeParse(sp.branch).success ? (sp.branch as string) : "";
  const page = pageNumber(sp.page);
  const base = `/clubs/${clubId}/students`;
  const link = (changes: Record<string, string | number | undefined>) => {
    const next = new URLSearchParams();
    for (const [key, value] of Object.entries({ view: view === "all" ? undefined : view, q: q || undefined, branch: branch || undefined, ...changes })) if (value !== undefined && value !== "") next.set(key, String(value));
    const qs = next.toString();
    return qs ? `${base}?${qs}` : base;
  };

  let query = db.from("students")
    .select("id, full_name, date_of_birth, gender, status, phone, guardian_name, guardian_phone, branch_id, belt_level_id, join_date, notes, archived_at, branch:branches!students_club_id_branch_id_fkey(name)", { count: "exact" })
    .eq("club_id", clubId);
  query = view === "archived" ? query.not("archived_at", "is", null) : query.is("archived_at", null);
  if (view === "active" || view === "inactive") query = query.eq("status", view);
  if (branch === "none") query = query.is("branch_id", null);
  else if (branch) query = query.eq("branch_id", branch);
  if (q) {
    const digits = q.replace(/\D/g, "");
    const filters = [`full_name.ilike.%${q}%`, `guardian_name.ilike.%${q}%`];
    if (digits.length >= 3) filters.push(`phone.ilike.%${digits}%`, `guardian_phone.ilike.%${digits}%`);
    query = query.or(filters.join(","));
  }
  const from = (page - 1) * PAGE_SIZE;
  // Membership check, the student page and the branch filter options: one parallel round trip.
  const [{ club }, { data: students, count, error }, branches, beltLevels] = await Promise.all([
    requireClub(clubId),
    query.order("full_name").order("id").range(from, from + PAGE_SIZE - 1),
    db.from("branches").select("id, name, archived_at").eq("club_id", clubId).order("name").limit(200),
    listBeltLevels(db, clubId),
  ]);
  if (error || branches.error) throw new Error("Unable to load students.");
  const total = count ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const filtered = !!q || !!branch;
  // "3 students added." after saving siblings together; the count is only trusted as a small integer.
  const createdCount = Number(sp.count);
  const createdMany = Number.isInteger(createdCount) && createdCount >= 2 && createdCount <= 50 ? `${createdCount} students added.` : "Students added.";
  // New students can only join current branches; preselect the branch the list is filtered to.
  const activeBranches = branches.data.filter((b) => !b.archived_at).map((b) => ({ id: b.id, name: b.name, archived: false }));
  const initialBranchId = activeBranches.some((b) => b.id === branch) ? branch : undefined;
  // Belts come from the club's levels loaded above (one query, archived included), not per row.
  const beltById = new Map(beltLevels.map((level) => [level.id, level]));
  const beltOf = (levelId: string | null) => (levelId ? beltById.get(levelId) : undefined);
  // Profile links carry the list's view, search, branch and page so "Back to Students" returns here.
  const listQuery = link({ page: page > 1 ? page : undefined }).slice(base.length);

  return (
    <>
      <PageHeader title="Students" description="Everyone training with your club." actions={<AddStudentMenu clubId={club.id} beltLevels={beltLevels} settingsHref={`/clubs/${club.id}/settings`} action={addStudents.bind(null, club.id)} clubName={club.name} today={todayInMalaysia()} branches={activeBranches} initialBranchId={initialBranchId} />} />
      <Notice code={sp.notice} messages={{ ...notices, "created-many": createdMany }} />
      <ViewTabs label="Student status" tabs={views.map((v) => ({ href: link({ view: v === "all" ? undefined : v, page: undefined }), label: v === "all" ? "All current" : v[0].toUpperCase() + v.slice(1), active: view === v }))} />
      <form role="search" action={base} className="mb-6 grid gap-2.5 sm:grid-cols-[minmax(0,1fr)_13rem_auto]">
        {view !== "all" && <input type="hidden" name="view" value={view} />}
        <label className="sr-only" htmlFor="student-search">Search students</label>
        <SearchInput id="student-search" name="q" defaultValue={q} maxLength={80} placeholder="Search by name or phone" />
        <label className="sr-only" htmlFor="student-branch">Branch</label>
        <select id="student-branch" name="branch" defaultValue={branch} className="field-select">
          <option value="">All branches</option>
          <option value="none">No branch</option>
          {branches.data.map((b) => <option key={b.id} value={b.id}>{b.archived_at ? `${b.name} (archived)` : b.name}</option>)}
        </select>
        <Button type="submit" variant="outline">Search</Button>
      </form>

      {students.length === 0 ? (
        <EmptyState
          image={assets.emptyStudents}
          title={filtered ? "No students match your search" : view === "archived" ? "No archived students" : total === 0 && page === 1 ? "No students yet" : "No students on this page"}
          description={filtered ? "Try a different name, phone number or branch." : view === "archived" ? "Students you archive will appear here and can be restored." : "Add your first student to get started."}
          action={filtered && <Link href={link({ q: undefined, branch: undefined, page: undefined })} className={buttonVariants({ variant: "outline", size: "sm" })}>Clear search</Link>}
        />
      ) : (
        <>
          <p className="mb-3 text-[0.8125rem] text-slate-500" aria-live="polite">{total} {total === 1 ? "student" : "students"}</p>
          <StudentEditProvider clubId={club.id} today={todayInMalaysia()} branches={branches.data} beltLevels={beltLevels}>
            {/* Desktop: table */}
            <div className="hidden overflow-x-auto rounded-2xl border border-border bg-white md:block">
              <table className="data-table">
                <caption className="sr-only">Students</caption>
                <thead>
                  <tr>
                    <th scope="col" className="px-5 py-3">Name</th>
                    <th scope="col" className="px-5 py-3">Belt</th>
                    <th scope="col" className="px-5 py-3">Parent / Guardian</th>
                    <th scope="col" className="whitespace-nowrap px-5 py-3">Date joined</th>
                    <th scope="col" className="px-5 py-3">Status</th>
                    <th scope="col" className="px-5 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {students.map((s) => (
                    <tr key={s.id} className="align-middle hover:bg-slate-50/80">
                      <td className="min-w-52 px-5 py-3.5">
                        <span className="flex items-center gap-3">
                          <InitialsAvatar name={s.full_name} />
                          <span className="min-w-0">
                            <Link href={`${base}/${s.id}${listQuery}`} className="break-words font-semibold hover:text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">{s.full_name}</Link>
                            <span className="mt-0.5 block break-words text-[0.8125rem] text-slate-500">{s.branch?.name ?? "No branch"}</span>
                          </span>
                        </span>
                      </td>
                      <td className="min-w-40 px-5 py-3.5"><StudentBelt level={beltOf(s.belt_level_id)} /></td>
                      <td className="min-w-40 px-5 py-3.5"><Guardian name={s.guardian_name} phone={s.guardian_phone} /></td>
                      <td className="whitespace-nowrap px-5 py-3.5 text-slate-600">{formatDate(s.join_date)}</td>
                      <td className="px-5 py-3.5"><StatusBadge status={s.status} archived={!!s.archived_at} /></td>
                      {/* Actions sit outside the name link, so Edit never opens the profile. */}
                      <td className="px-5 py-3 text-right"><EditStudentDialog student={s} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* Mobile: compact cards with labelled fields */}
            <ul className="overflow-hidden rounded-2xl border border-border bg-white md:hidden">
              {students.map((s) => (
                <li key={s.id} className="border-b border-border px-4 py-4 last:border-b-0">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <InitialsAvatar name={s.full_name} />
                      <div className="min-w-0">
                        <Link href={`${base}/${s.id}${listQuery}`} className="break-words font-semibold hover:text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">{s.full_name}</Link>
                        <span className="mt-0.5 block break-words text-[0.8125rem] text-slate-500">{s.branch?.name ?? "No branch"}</span>
                      </div>
                    </div>
                    <div className="shrink-0"><EditStudentDialog student={s} /></div>
                  </div>
                  <dl className="mt-3 grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-4 gap-y-2 text-sm">
                    <dt className="text-slate-500">Belt</dt><dd className="min-w-0"><StudentBelt level={beltOf(s.belt_level_id)} /></dd>
                    <dt className="text-slate-500">Parent / Guardian</dt><dd className="min-w-0"><Guardian name={s.guardian_name} phone={s.guardian_phone} /></dd>
                    <dt className="text-slate-500">Date joined</dt><dd>{formatDate(s.join_date)}</dd>
                    <dt className="text-slate-500">Status</dt><dd><StatusBadge status={s.status} archived={!!s.archived_at} /></dd>
                  </dl>
                </li>
              ))}
            </ul>
          </StudentEditProvider>
        </>
      )}
      {pages > 1 && <Pagination page={page} pages={pages} previousHref={page > 1 ? link({ page: page - 1 }) : undefined} nextHref={page < pages ? link({ page: page + 1 }) : undefined} />}
    </>
  );
}

/**
 * Students-page belt cell: the shared belt icon beside the level name, grouped as one unit, with
 * long names wrapping beside the icon. Archived levels still show on students who have them.
 */
function StudentBelt({ level }: { level?: BeltLevel }) {
  if (!level) return <span className="text-slate-400">Not assigned</span>;
  return (
    <span className="inline-flex max-w-52 items-center gap-2.5">
      <BeltSwatch color={level.color} stripe={level.stripe_color} />
      <span className="min-w-0 break-words leading-snug">
        {level.name}
        <span className="sr-only"> ({describeBelt(level.color, level.stripe_color)})</span>
        {level.archived_at && <span className="block text-xs text-slate-500">Archived level</span>}
      </span>
    </span>
  );
}

/** The student's guardian contact (one per student today); phone as lighter secondary text. */
function Guardian({ name, phone }: { name: string | null; phone: string | null }) {
  if (!name && !phone) return <span className="text-slate-400">Not provided</span>;
  return (
    <>
      <span className="block break-words">{name ?? <span className="text-slate-400">Not provided</span>}</span>
      {phone && <span className="mt-0.5 block break-words text-slate-500">{phone}</span>}
    </>
  );
}
