import Link from "next/link";
import { assets } from "@/lib/assets";
import { clubClient, requireClub } from "@/lib/clubs";
import { branchPalette } from "@/lib/finance/queries";
import { PageHeader } from "@/components/page-header";
import { ViewTabs } from "@/components/view-tabs";
import { EmptyState } from "@/components/empty-state";
import { Notice } from "@/components/notice";
import { StatusBadge } from "@/components/students/status-badge";
import { AddBranchDialog, EditBranchDialog } from "@/components/branches/branch-form";
import { addBranch } from "./actions";

export const metadata = { title: "Branches" };
const notices = { created: "Branch added.", updated: "Branch updated.", archived: "Branch archived.", restored: "Branch restored." };

// Branch details plus a count of its current (non-archived) students, embedded in the same
// query (one request, not one per branch). The count uses the same definition as the branch
// page: active and inactive students, excluding archived ones.
const BRANCH_COLUMNS = "id, name, address, address_line1, address_line2, postcode, city, state, coach_name, coach_role, coach_phone, coach_email, archived_at, students!students_club_id_branch_id_fkey(count)";

export default async function Branches({ params, searchParams }: PageProps<"/clubs/[clubId]/branches">) {
  const { clubId } = await params;
  const { view, notice } = await searchParams;
  const archived = view === "archived";
  const { db } = await clubClient(clubId);
  let query = db.from("branches").select(BRANCH_COLUMNS).eq("club_id", clubId).is("students.archived_at", null).order("name").limit(200);
  query = archived ? query.not("archived_at", "is", null) : query.is("archived_at", null);
  // Membership check and the RLS-scoped list run in parallel.
  const [{ club }, { data: branches, error }, palette] = await Promise.all([requireClub(clubId), query, branchPalette(clubId)]);
  const base = `/clubs/${club.id}/branches`;
  if (error) throw new Error("Unable to load branches.");
  const studentCount = (b: (typeof branches)[number]) => b.students?.[0]?.count ?? 0;

  return (
    <>
      <PageHeader title="Branches" description="The locations where your club trains." actions={<AddBranchDialog action={addBranch.bind(null, club.id)} clubName={club.name} palette={palette} />} />
      <Notice code={notice} messages={notices} />
      <ViewTabs label="Branch status" tabs={[{ href: base, label: "Active", active: !archived }, { href: `${base}?view=archived`, label: "Archived", active: archived }]} />
      {branches.length === 0 ? (
        <EmptyState
          image={assets.emptyBranches}
          title={archived ? "No archived branches" : "No branches yet"}
          description={archived ? "Branches you archive will appear here and can be restored." : "Add your first branch so you can place students there."}
          action={!archived && <AddBranchDialog action={addBranch.bind(null, club.id)} clubName={club.name} palette={palette} />}
        />
      ) : (
        <>
          <p className="mb-3 text-[0.8125rem] text-slate-500" aria-live="polite">{branches.length} {branches.length === 1 ? "branch" : "branches"} · student counts exclude archived students</p>
          {/* Desktop: table (same styling as the Students table). Column sizes come from the colgroup:
              compact fixed widths for Students, Status and Actions; the rest share the remaining width. */}
          <div className="hidden overflow-x-auto rounded-2xl border border-border bg-white md:block">
            <table className="data-table min-w-[52rem] table-fixed">
              <caption className="sr-only">Branches</caption>
              <colgroup>
                <col />
                <col />
                <col className="w-28" />
                <col />
                <col className="w-[8.5rem]" />
                <col className="w-[7.5rem]" />
              </colgroup>
              <thead>
                <tr>
                  <th scope="col" className="px-5 py-3 text-left">Branch name</th>
                  <th scope="col" className="px-5 py-3 text-left">Location</th>
                  <th scope="col" className="px-5 py-3 text-center"><abbr title="Current students (active and inactive, not archived)" className="no-underline">Students</abbr></th>
                  <th scope="col" className="px-5 py-3 text-left">Contact</th>
                  <th scope="col" className="px-5 py-3 text-center">Status</th>
                  <th scope="col" className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {branches.map((b) => (
                  <tr key={b.id} className="hover:bg-slate-50/80">
                    <td className="px-5 py-4 align-middle">
                      {/* The branch's own page (details, archive/restore). */}
                      <Link href={`${base}/${b.id}/edit`} className="break-words font-semibold hover:text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">{b.name}</Link>
                    </td>
                    <td className="px-5 py-4 align-middle text-slate-600"><Location address={b.address} /></td>
                    <td className="px-5 py-4 text-center align-middle"><span className="inline-flex min-w-8 justify-center rounded-full bg-muted px-2 py-0.5 text-[0.8125rem] font-semibold tabular-nums">{studentCount(b)}</span></td>
                    <td className="px-5 py-4 align-middle"><Contact name={b.coach_name} role={b.coach_role} phone={b.coach_phone} email={b.coach_email} roleOnOwnLine /></td>
                    <td className="whitespace-nowrap px-5 py-4 text-center align-middle"><span className="inline-flex shrink-0"><StatusBadge status="active" archived={!!b.archived_at} /></span></td>
                    {/* Actions sit outside the name link, so Edit never navigates. */}
                    <td className="whitespace-nowrap px-5 py-4 text-right align-middle"><span className="inline-flex shrink-0"><EditBranchDialog clubId={club.id} branch={b} palette={palette} /></span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* Mobile: compact cards with labelled fields */}
          <ul className="overflow-hidden rounded-2xl border border-border bg-white md:hidden">
            {branches.map((b) => (
              <li key={b.id} className="border-b border-border px-4 py-4 last:border-b-0">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link href={`${base}/${b.id}/edit`} className="break-words font-semibold hover:text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">{b.name}</Link>
                  </div>
                  <div className="shrink-0"><EditBranchDialog clubId={club.id} branch={b} palette={palette} /></div>
                </div>
                <dl className="mt-3 grid grid-cols-[auto_minmax(0,1fr)] items-start gap-x-4 gap-y-2 text-sm">
                  <dt className="text-slate-500">Location</dt><dd className="min-w-0 text-slate-700"><Location address={b.address} /></dd>
                  <dt className="text-slate-500">Students</dt><dd className="font-semibold tabular-nums">{studentCount(b)} <span className="font-normal text-slate-500">current</span></dd>
                  <dt className="text-slate-500">Contact</dt><dd className="min-w-0"><Contact name={b.coach_name} role={b.coach_role} phone={b.coach_phone} email={b.coach_email} /></dd>
                  <dt className="text-slate-500">Status</dt><dd><StatusBadge status="active" archived={!!b.archived_at} /></dd>
                </dl>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}

/** The branch's stored one-line address (kept in sync with the structured address fields). */
function Location({ address }: { address: string }) {
  return address ? <span className="block whitespace-pre-line break-words">{address}</span> : <span className="text-slate-400">Not provided</span>;
}

/** Branch contact: the coach's name and role, with phone and email as secondary text. */
function Contact({ name, role, phone, email, roleOnOwnLine = false }: { name: string | null; role: string | null; phone: string | null; email: string | null; roleOnOwnLine?: boolean }) {
  if (!name && !phone && !email) return <span className="text-slate-400">Not provided</span>;
  return (
    <>
      <span className="block break-words">
        {name ?? <span className="text-slate-400">Not provided</span>}
        {name && role && !roleOnOwnLine && <span className="text-slate-500"> · {role}</span>}
      </span>
      {/* Table: role on its own smaller, muted line under the name. Mobile cards keep "name · role". */}
      {name && role && roleOnOwnLine && <span className="block break-words text-xs text-slate-500">{role}</span>}
      {phone && <span className="mt-0.5 block break-words text-slate-500">{phone}</span>}
      {email && <span className="mt-0.5 block break-words text-slate-500">{email}</span>}
    </>
  );
}
