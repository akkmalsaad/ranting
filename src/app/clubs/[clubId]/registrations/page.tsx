import Link from "next/link";
import { AlertTriangle, CircleCheck, CircleX, Inbox, Users } from "lucide-react";
import { clubClient, requireClub } from "@/lib/clubs";
import { branchScope } from "@/lib/finance/queries";
import { APPLICATION_COLUMNS, duplicateNotes, siblingsBySubmission } from "@/lib/registrations";
import { applicationStatuses, idSchema, pageNumber, type ApplicationStatus } from "@/lib/validation";
import { PageHeader } from "@/components/page-header";
import { ViewTabs } from "@/components/view-tabs";
import { Notice } from "@/components/notice";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import { InitialsAvatar } from "@/components/initials-avatar";
import { Pagination } from "@/components/pagination";
import { cn } from "@/lib/utils";
import { ReviewApplicationDialog } from "@/components/registrations/review-application-dialog";
import { requireUser } from "@/lib/supabase/server";
import { listBeltLevels } from "@/lib/belt-levels";

export const metadata = { title: "Registrations" };
const PAGE_SIZE = 25;
const labels: Record<ApplicationStatus, string> = { pending: "Pending", approved: "Approved", rejected: "Rejected" };
const when = new Intl.DateTimeFormat("en-MY", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kuala_Lumpur" });

/** All registrations by status (pending, approved, rejected), optionally for one requested branch. */
export default async function Registrations({ params, searchParams }: PageProps<"/clubs/[clubId]/registrations">) {
  const { clubId } = await params;
  const sp = await searchParams;
  const status: ApplicationStatus = applicationStatuses.find((s) => s === sp.status) ?? "pending";
  // "Submitted together": every child from one parent submission, whatever their status.
  const submission = idSchema.safeParse(sp.submission).success ? (sp.submission as string) : "";
  const page = pageNumber(sp.page);
  const { db } = await clubClient(clubId);
  const [{ club }, scope, { userId }, beltLevels] = await Promise.all([requireClub(clubId), branchScope(clubId, sp.branch), requireUser(), listBeltLevels(db, clubId)]);
  const base = `/clubs/${club.id}/registrations`;
  const href = (changes: Record<string, string | number | undefined>) => {
    const next = new URLSearchParams();
    for (const [key, value] of Object.entries({ status: status === "pending" ? undefined : status, branch: scope.id || undefined, ...changes })) if (value !== undefined && value !== "") next.set(key, String(value));
    const qs = next.toString();
    return qs ? `${base}?${qs}` : base;
  };

  let query = db.from("student_applications").select(APPLICATION_COLUMNS, { count: "exact" }).eq("club_id", club.id);
  if (submission) query = query.eq("submission_id", submission);
  else query = query.eq("status", status);
  if (scope.id && !submission) query = query.eq("requested_branch_id", scope.id);
  const from = (page - 1) * PAGE_SIZE;
  const ordered = submission ? query.order("submission_position") : query.order(status === "pending" ? "submitted_at" : "reviewed_at", { ascending: status === "pending" });
  const { data, count, error } = await ordered.order("id").range(from, from + PAGE_SIZE - 1);
  const applications = data ?? [];
  const [duplicates, siblings] = applications.length
    ? await Promise.all([duplicateNotes(db, club.id, applications), siblingsBySubmission(db, club.id, applications)])
    : [{}, {}];
  const pages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));
  const branchName = (id: string | null) => scope.options.find((b) => b.id === id)?.name ?? "No branch";

  return (
    <>
      <PageHeader
        back={{ href: `/clubs/${club.id}${scope.id ? `?branch=${scope.id}` : ""}`, label: "Back to overview" }}
        title={submission ? "Submitted together" : "Registrations"}
        description={submission ? "Children registered in one parent submission, with the same guardian contact. Each is reviewed separately." : scope.selected ? `Requested for ${scope.selected.name}` : "Student registrations awaiting or after review."}
      />
      <Notice code={sp.notice} messages={{ approved: "Registration approved. The student has been added.", rejected: "Registration rejected." }} />
      {submission
        ? <Link href={href({ page: undefined })} className={cn(buttonVariants({ variant: "outline", size: "sm" }), "mb-6")}>Show all registrations</Link>
        : <ViewTabs label="Registration status" tabs={applicationStatuses.map((s) => ({ href: href({ status: s === "pending" ? undefined : s, page: undefined }), label: labels[s], active: status === s }))} />}
      {error ? <p role="alert" className="panel text-sm text-slate-600">Unable to load registrations. Reload to try again.</p>
        : applications.length === 0 ? (
          <EmptyState
            icon={Inbox}
            title={`No ${labels[status].toLowerCase()} registrations`}
            description={status === "pending" ? "New registrations from your shared links appear here for review." : undefined}
            action={scope.selected && <Link href={href({ branch: undefined, page: undefined })} className={buttonVariants({ variant: "outline", size: "sm" })}>Show all branches</Link>}
          />
        ) : (
          <>
            <p className="mb-3 text-[0.8125rem] text-slate-500" aria-live="polite">{count ?? applications.length} {(count ?? applications.length) === 1 ? "registration" : "registrations"}</p>
            <ul className="overflow-hidden rounded-2xl border border-border bg-white">
              {applications.map((a) => (
                <li key={a.id} className="flex items-start gap-3 border-b border-border px-4 py-4 last:border-b-0 sm:items-center sm:px-6">
                  <InitialsAvatar name={a.full_name} />
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                      <span className="break-words text-[0.9375rem] font-semibold">{a.full_name}</span>
                      {a.status === "pending" && duplicates[a.id] && <Badge tone="warning" icon={AlertTriangle}>Possible duplicate</Badge>}
                      {a.status === "approved" && <Badge tone="success" icon={CircleCheck}>Approved</Badge>}
                      {a.status === "rejected" && <Badge icon={CircleX}>Rejected</Badge>}
                    </p>
                    <p className="mt-1 flex flex-wrap gap-x-2 text-[0.8125rem] text-slate-500">
                      <span>{a.guardian_name ?? "No guardian listed"}</span>
                      <span aria-hidden>·</span>
                      <span>Requested: {branchName(a.requested_branch_id)}</span>
                      <span aria-hidden>·</span>
                      <span>Submitted {when.format(new Date(a.submitted_at))}</span>
                    </p>
                    {siblings[a.id] && !submission && <Link href={href({ submission: a.submission_id ?? undefined, page: undefined })} className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"><Users size={12} aria-hidden /> Submitted with {siblings[a.id].length} {siblings[a.id].length === 1 ? "sibling" : "siblings"}</Link>}
                    {a.status !== "pending" && (
                      <p className="mt-1 text-[0.8125rem] text-slate-600">
                        {labels[a.status as ApplicationStatus]} {a.reviewed_at ? when.format(new Date(a.reviewed_at)) : ""}{a.reviewed_by === userId ? " by you" : " by another owner"}
                        {a.status === "approved" && <span className="text-slate-500"> · Branch: {branchName(a.approved_branch_id)}</span>}
                        {a.status === "rejected" && a.rejection_reason && <span className="block break-words text-slate-500">Reason: {a.rejection_reason}</span>}
                      </p>
                    )}
                  </div>
                  <div className="shrink-0">
                    {a.status === "pending" && <ReviewApplicationDialog clubId={club.id} application={a} branches={scope.options} duplicates={duplicates[a.id]} siblings={siblings[a.id]} beltLevels={beltLevels} />}
                    {a.status === "approved" && a.student_id && <Link href={`/clubs/${club.id}/students/${a.student_id}`} className={buttonVariants({ variant: "outline", size: "sm" })}>View student</Link>}
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      {pages > 1 && <Pagination page={page} pages={pages} previousHref={page > 1 ? href({ page: page - 1 }) : undefined} nextHref={page < pages ? href({ page: page + 1 }) : undefined} />}
    </>
  );
}
