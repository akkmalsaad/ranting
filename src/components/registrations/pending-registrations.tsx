import { AlertTriangle, Users } from "lucide-react";
import { ReviewApplicationDialog } from "@/components/registrations/review-application-dialog";
import { InitialsAvatar } from "@/components/initials-avatar";
import { SectionCard, SectionLink, SectionMessage } from "@/components/section-card";
import type { Application, DuplicateNote, Sibling } from "@/lib/registrations";
import type { BeltLevel } from "@/lib/belt-levels";

type Branch = { id: string; name: string; archived_at: string | null };
const submittedOn = new Intl.DateTimeFormat("en-MY", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kuala_Lumpur" });

/** Dashboard panel: registrations awaiting approval (respects the selected branch). */
export function PendingRegistrations({ clubId, count, applications, duplicates, siblings = {}, beltLevels = [], branches, viewAllHref, failed }: {
  clubId: string; count: number; applications: Application[]; duplicates: Record<string, DuplicateNote[]>; siblings?: Record<string, Sibling[]>; beltLevels?: BeltLevel[]; branches: Branch[]; viewAllHref: string; failed: boolean;
}) {
  const branchName = (id: string | null) => branches.find((b) => b.id === id)?.name ?? "No branch requested";
  return (
    <SectionCard
      id="pending-title"
      title="Pending registrations"
      description={failed ? undefined : count ? "Waiting for your review" : "All caught up"}
      badge={!failed && <span className={`rounded-full px-2 py-0.5 text-xs font-bold tabular-nums ${count ? "bg-primary text-white" : "bg-muted text-slate-600"}`}>{count}<span className="sr-only"> awaiting approval</span></span>}
      action={<SectionLink href={viewAllHref}>View all registrations</SectionLink>}
    >
      {failed ? (
        <SectionMessage alert>Unable to load registrations. Reload to try again.</SectionMessage>
      ) : applications.length === 0 ? (
        <SectionMessage>No registrations awaiting approval.</SectionMessage>
      ) : (
        <>
          <ul className="divide-y divide-border">
            {applications.map((a) => (
              <li key={a.id} className="flex items-center gap-3 py-3.5">
                <InitialsAvatar name={a.full_name} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[0.9375rem] font-semibold">{a.full_name}</p>
                  <p className="mt-0.5 flex flex-wrap gap-x-2 text-[0.8125rem] text-slate-500">
                    <span>{a.guardian_name ?? "No guardian listed"}</span>
                    <span aria-hidden>·</span>
                    <span>{branchName(a.requested_branch_id)}</span>
                    <span aria-hidden>·</span>
                    <span>{submittedOn.format(new Date(a.submitted_at))}</span>
                  </p>
                  {(siblings[a.id] || duplicates[a.id]) && (
                    <p className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
                      {siblings[a.id] && <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary"><Users size={12} aria-hidden /> +{siblings[a.id].length} {siblings[a.id].length === 1 ? "sibling" : "siblings"}</span>}
                      {duplicates[a.id] && <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-800"><AlertTriangle size={12} aria-hidden /> Possible duplicate</span>}
                    </p>
                  )}
                </div>
                <div className="shrink-0"><ReviewApplicationDialog clubId={clubId} application={a} branches={branches} duplicates={duplicates[a.id]} siblings={siblings[a.id]} beltLevels={beltLevels} /></div>
              </li>
            ))}
          </ul>
          {count > applications.length && <p className="border-t border-border py-3 text-sm text-slate-600">Showing {applications.length} of {count}. <SectionLink href={viewAllHref}>View all</SectionLink></p>}
        </>
      )}
    </SectionCard>
  );
}
