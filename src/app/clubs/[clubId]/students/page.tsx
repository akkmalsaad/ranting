import Image from "next/image";
import Link from "next/link";
import { CircleCheck, CircleMinus, Archive, Plus, Search } from "lucide-react";
import { assets } from "@/lib/assets";
import { requireClub } from "@/lib/clubs";
import { formatDate } from "@/lib/format";
import { idSchema, pageNumber, searchTerm } from "@/lib/validation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/page-header";
import { ViewTabs } from "@/components/view-tabs";
import { Notice } from "@/components/notice";

export const metadata = { title: "Students" };
const PAGE_SIZE = 25;
const notices = { created: "Student added.", updated: "Student updated.", archived: "Student archived.", restored: "Student restored." };
const views = ["all", "active", "inactive", "archived"] as const;
type View = (typeof views)[number];

export default async function Students({ params, searchParams }: PageProps<"/clubs/[clubId]/students">) {
  const { clubId } = await params;
  const sp = await searchParams;
  const { db, club } = await requireClub(clubId);
  const view: View = views.find((v) => v === sp.view) ?? "all";
  const q = searchTerm(sp.q);
  const branch = sp.branch === "none" || idSchema.safeParse(sp.branch).success ? (sp.branch as string) : "";
  const page = pageNumber(sp.page);
  const base = `/clubs/${club.id}/students`;
  const link = (changes: Record<string, string | number | undefined>) => {
    const next = new URLSearchParams();
    for (const [key, value] of Object.entries({ view: view === "all" ? undefined : view, q: q || undefined, branch: branch || undefined, ...changes })) if (value !== undefined && value !== "") next.set(key, String(value));
    const qs = next.toString();
    return qs ? `${base}?${qs}` : base;
  };

  let query = db.from("students")
    .select("id, full_name, status, phone, guardian_name, guardian_phone, join_date, archived_at, branch:branches!students_club_id_branch_id_fkey(name)", { count: "exact" })
    .eq("club_id", club.id);
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
  const [{ data: students, count, error }, branches] = await Promise.all([
    query.order("full_name").order("id").range(from, from + PAGE_SIZE - 1),
    db.from("branches").select("id, name, archived_at").eq("club_id", club.id).order("name").limit(200),
  ]);
  if (error || branches.error) throw new Error("Unable to load students.");
  const total = count ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const filtered = !!q || !!branch;

  return (
    <>
      <PageHeader title="Students" description="Everyone training with your club." actions={<Button asChild><Link href={`${base}/new`}><Plus size={16} aria-hidden /> Add student</Link></Button>} />
      <Notice code={sp.notice} messages={notices} />
      <ViewTabs label="Student status" tabs={views.map((v) => ({ href: link({ view: v === "all" ? undefined : v, page: undefined }), label: v === "all" ? "All current" : v[0].toUpperCase() + v.slice(1), active: view === v }))} />
      <form role="search" action={base} className="mb-6 grid gap-3 sm:grid-cols-[1fr_220px_auto]">
        {view !== "all" && <input type="hidden" name="view" value={view} />}
        <label className="sr-only" htmlFor="student-search">Search students</label>
        <Input id="student-search" name="q" type="search" defaultValue={q} maxLength={80} placeholder="Search by name or phone" />
        <label className="sr-only" htmlFor="student-branch">Branch</label>
        <select id="student-branch" name="branch" defaultValue={branch}>
          <option value="">All branches</option>
          <option value="none">No branch</option>
          {branches.data.map((b) => <option key={b.id} value={b.id}>{b.archived_at ? `${b.name} (archived)` : b.name}</option>)}
        </select>
        <Button type="submit" variant="outline"><Search size={16} aria-hidden /> Search</Button>
      </form>

      {students.length === 0 ? (
        <section className="panel flex flex-col items-center py-12 text-center">
          <Image src={assets.emptyStudents} alt="" className="h-auto w-40" />
          <h2 className="mt-6">{filtered ? "No students match your search" : view === "archived" ? "No archived students" : total === 0 && page === 1 ? "No students yet" : "No students on this page"}</h2>
          <p className="mt-2 max-w-sm text-sm text-slate-600">{filtered ? "Try a different name, phone number or branch." : view === "archived" ? "Students you archive will appear here and can be restored." : "Add your first student to get started."}</p>
          {filtered && <Link href={link({ q: undefined, branch: undefined, page: undefined })} className="mt-4 text-sm font-semibold text-primary underline">Clear search</Link>}
        </section>
      ) : (
        <>
          <p className="mb-3 text-sm text-slate-600" aria-live="polite">{total} {total === 1 ? "student" : "students"}</p>
          <ul className="overflow-hidden rounded-[1.25rem] border border-border bg-white">
            {students.map((s) => (
              <li key={s.id} className="border-b border-border last:border-b-0">
                <Link href={`${base}/${s.id}/edit`} className="grid gap-2 p-4 hover:bg-muted/60 sm:grid-cols-[1.4fr_1fr_1fr_auto] sm:items-center sm:gap-4 sm:px-6">
                  <span className="min-w-0">
                    <span className="block truncate font-semibold">{s.full_name}</span>
                    <span className="block truncate text-sm text-slate-500">{s.branch?.name ?? "No branch"}</span>
                  </span>
                  <span className="min-w-0 text-sm text-slate-600">
                    <span className="block truncate">{s.guardian_name ?? "No guardian listed"}</span>
                    <span className="block truncate text-slate-500">{s.guardian_phone ?? s.phone ?? ""}</span>
                  </span>
                  <span className="text-sm text-slate-600">Joined {formatDate(s.join_date)}</span>
                  <StatusBadge status={s.status} archived={!!s.archived_at} />
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
      {pages > 1 && (
        <nav aria-label="Pagination" className="mt-6 flex items-center justify-between gap-4 text-sm">
          {page > 1 ? <Link href={link({ page: page - 1 })} className="font-semibold text-primary hover:underline">← Previous</Link> : <span />}
          <span className="text-slate-600">Page {Math.min(page, pages)} of {pages}</span>
          {page < pages ? <Link href={link({ page: page + 1 })} className="font-semibold text-primary hover:underline">Next →</Link> : <span />}
        </nav>
      )}
    </>
  );
}

function StatusBadge({ status, archived }: { status: string; archived: boolean }) {
  const [Icon, label, style] = archived ? [Archive, "Archived", "bg-slate-100 text-slate-700"] : status === "active" ? [CircleCheck, "Active", "bg-emerald-50 text-emerald-800"] : [CircleMinus, "Inactive", "bg-amber-50 text-amber-800"];
  return <span className={`inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${style}`}><Icon size={14} aria-hidden /> {label}</span>;
}
