"use client";
import { useMemo } from "react";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { ActionForm } from "@/components/action-form";
import { SelectField, TextAreaField } from "@/components/field";
import { Button } from "@/components/ui/button";
import { FormDialog, SaveWatcher, useFormDialog } from "@/components/form-dialog";
import { approveApplication, rejectApplication } from "@/app/clubs/[clubId]/registrations/actions";
import { applicationApprovalSchema, applicationRejectionSchema } from "@/lib/validation";
import { BeltLevelField, type BeltLevelOption } from "@/components/students/belt-level-field";

export type ReviewableApplication = {
  id: string; full_name: string; date_of_birth: string | null; gender: string | null; phone: string | null;
  guardian_name: string | null; guardian_phone: string | null; notes: string | null; requested_branch_id: string | null; submitted_at: string;
  submission_id?: string | null;
};
type Branch = { id: string; name: string; archived_at: string | null };
type Duplicate = { message: string; studentId?: string };
type Sibling = { id: string; full_name: string; status: string };
const STATUS: Record<string, string> = { pending: "Pending", approved: "Approved", rejected: "Rejected" };

const dateOnly = (value: string) => new Intl.DateTimeFormat("en-MY", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`));
const submitted = (value: string) => new Intl.DateTimeFormat("en-MY", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kuala_Lumpur" }).format(new Date(value));

/** "Review" button plus the review modal (shared FormDialog): approve with a confirmed branch, or reject. */
export function ReviewApplicationDialog({ clubId, application, branches, duplicates = [], siblings = [], beltLevels = [] }: { clubId: string; application: ReviewableApplication; branches: Branch[]; duplicates?: Duplicate[]; siblings?: Sibling[]; beltLevels?: BeltLevelOption[] }) {
  return (
    <FormDialog
      label="Review"
      title="Review registration"
      description={<>{application.full_name} · submitted {submitted(application.submitted_at)}</>}
      noticeParams={() => ({})}
      trigger={{ icon: "none", variant: "outline", size: "sm", ariaLabel: `Review registration for ${application.full_name}` }}
    >
      <ReviewContent clubId={clubId} application={application} branches={branches} duplicates={duplicates} siblings={siblings} beltLevels={beltLevels} />
    </FormDialog>
  );
}

function ReviewContent({ clubId, application, branches, duplicates, siblings, beltLevels }: { clubId: string; application: ReviewableApplication; branches: Branch[]; duplicates: Duplicate[]; siblings: Sibling[]; beltLevels: BeltLevelOption[] }) {
  const { close } = useFormDialog();
  const approve = useMemo(() => approveApplication.bind(null, clubId, application.id), [clubId, application.id]);
  const reject = useMemo(() => rejectApplication.bind(null, clubId, application.id), [clubId, application.id]);
  const active = branches.filter((b) => !b.archived_at);
  const requested = branches.find((b) => b.id === application.requested_branch_id);
  const gender = application.gender === "male" ? "Male" : application.gender === "female" ? "Female" : null;
  const details: [string, string | null][] = [
    ["Student name", application.full_name],
    ["Date of birth", application.date_of_birth ? dateOnly(application.date_of_birth) : null],
    ["Gender", gender],
    ["Student phone", application.phone],
    ["Guardian name", application.guardian_name],
    ["Guardian phone", application.guardian_phone],
    ["Requested branch", requested ? `${requested.name}${requested.archived_at ? " (archived)" : ""}` : null],
  ];

  return (
    <div className="space-y-6">
      {duplicates.length > 0 && (
        <div role="note" className="rounded-xl border border-amber-200/80 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <p className="flex items-center gap-2 font-semibold"><AlertTriangle size={16} aria-hidden /> Possible duplicate. Check before approving.</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {duplicates.map((d, i) => <li key={i}>{d.message} {d.studentId && <Link href={`/clubs/${clubId}/students/${d.studentId}`} className="font-semibold underline">View student</Link>}</li>)}
          </ul>
        </div>
      )}

      {siblings.length > 0 && (
        <section aria-labelledby="review-siblings" className="rounded-xl border border-primary/15 bg-primary/[0.04] px-4 py-3 text-sm">
          <h3 id="review-siblings" className="font-semibold">Submitted together</h3>
          <p className="mt-1 text-slate-600">This parent registered {siblings.length + 1} children in one submission, with the same guardian contact. Review each child separately.</p>
          <ul className="mt-2 space-y-1">
            {siblings.map((s) => <li key={s.id} className="flex flex-wrap items-center justify-between gap-2"><span className="font-medium">{s.full_name}</span><span className="text-xs font-semibold text-slate-500">{STATUS[s.status] ?? s.status}</span></li>)}
          </ul>
          {application.submission_id && <Link href={`/clubs/${clubId}/registrations?submission=${application.submission_id}`} className="mt-2 inline-block font-semibold text-primary hover:underline">View all from this submission</Link>}
        </section>
      )}

      <section aria-labelledby="review-details">
        <h3 id="review-details" className="form-legend">Submitted details</h3>
        <dl className="grid gap-x-6 gap-y-4 rounded-xl bg-slate-50 p-4 ring-1 ring-inset ring-border sm:grid-cols-2">
          {details.map(([label, value]) => (
            <div key={label} className="min-w-0">
              <dt className="text-[0.8125rem] text-slate-500">{label}</dt>
              <dd className="mt-0.5 break-words font-medium">{value ?? <span className="font-normal text-slate-400">Not provided</span>}</dd>
            </div>
          ))}
          <div className="min-w-0 sm:col-span-2">
            <dt className="text-[0.8125rem] text-slate-500">Notes</dt>
            <dd className="mt-0.5 whitespace-pre-line break-words">{application.notes ?? <span className="text-slate-400">Not provided</span>}</dd>
          </div>
        </dl>
      </section>

      <section aria-labelledby="review-approve" className="border-t border-border pt-6">
        <h3 id="review-approve" className="text-[0.9375rem] font-bold">Approve</h3>
        <p className="mb-4 mt-1 text-sm text-slate-600">Creates an active student record with today&apos;s join date.</p>
        <ActionForm action={approve} schema={applicationApprovalSchema} submit="Approve registration" footer={<Button type="button" variant="ghost" onClick={close}>Cancel</Button>}>
          <SaveWatcher />
          <SelectField name="branch_id" label="Branch" defaultValue={requested && !requested.archived_at ? requested.id : ""} options={[{ value: "", label: "No branch" }, ...active.map((b) => ({ value: b.id, label: b.name }))]} hint="Confirm the branch this student will join." />
          <BeltLevelField name="belt_level_id" levels={beltLevels.filter((l) => !l.archived_at)} settingsHref={`/clubs/${clubId}/settings`} />
        </ActionForm>
      </section>

      <section aria-labelledby="review-reject" className="border-t border-border pt-6">
        <h3 id="review-reject" className="text-[0.9375rem] font-bold">Reject</h3>
        <p className="mb-4 mt-1 text-sm text-slate-600">The registration is kept for reference and no student is created.</p>
        <ActionForm action={reject} schema={applicationRejectionSchema} submit="Reject" danger>
          <SaveWatcher />
          <TextAreaField name="rejection_reason" label="Reason (optional)" maxLength={500} hint="Internal note for your club. It isn't shown to the parent." />
        </ActionForm>
      </section>
    </div>
  );
}
