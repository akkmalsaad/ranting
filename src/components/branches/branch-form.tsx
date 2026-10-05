"use client";
import { useMemo } from "react";
import Link from "next/link";
import { ActionForm, type FormAction } from "@/components/action-form";
import { SelectField, TextField } from "@/components/field";
import { Button, buttonVariants } from "@/components/ui/button";
import { FormDialog, SaveWatcher, useFormDialog } from "@/components/form-dialog";
import { branchSchema, malaysianStates } from "@/lib/validation";
import type { Database } from "@/lib/supabase/database.types";
import { editBranch } from "@/app/clubs/[clubId]/branches/actions";
import { BranchCalendarFields } from "@/components/branches/branch-calendar-fields";
import { FormSection } from "@/components/form-section";
import type { BranchOption } from "@/lib/finance/queries";

export type BranchDetails = Pick<Database["public"]["Tables"]["branches"]["Row"], "name" | "address_line1" | "address_line2" | "postcode" | "city" | "state" | "coach_name" | "coach_phone" | "coach_role" | "coach_email">;

/**
 * The club's branches with their short codes and colours, for the Calendar section (codes in use,
 * colours in use). Undefined before the database has those columns: the section is then hidden.
 */
export type BranchPalette = BranchOption[] | undefined;

/**
 * Branch details, Calendar appearance, Address and Coach sections; shared by the Add branch modal,
 * Add branch page and Edit branch. Each field is Label / control / helper text, left-aligned; pairs
 * sit side by side from `sm` and stack on phones.
 */
export function BranchFields({ branch, branchId, palette }: { branch?: BranchDetails; branchId?: string; palette: BranchPalette }) {
  return (
    <>
      <FormSection title="Branch details">
        <div className="sm:col-span-2"><TextField name="name" label="Branch name" defaultValue={branch?.name} required minLength={2} maxLength={120} placeholder="e.g. Bukit Antarabangsa" /></div>
      </FormSection>
      {palette && <BranchCalendarFields branchId={branchId} initialName={branch?.name} palette={palette} />}
      <FormSection title="Address">
        <div className="sm:col-span-2"><TextField name="address_line1" label="Address line 1" defaultValue={branch?.address_line1} maxLength={200} autoComplete="off" hint="Optional. Where this branch trains." /></div>
        <div className="sm:col-span-2"><TextField name="address_line2" label="Address line 2" defaultValue={branch?.address_line2} maxLength={200} autoComplete="off" hint="Optional" /></div>
        <TextField name="postcode" label="Postcode" defaultValue={branch?.postcode} inputMode="numeric" maxLength={10} autoComplete="off" placeholder="e.g. 68000" />
        <TextField name="city" label="City" defaultValue={branch?.city} maxLength={100} autoComplete="off" />
        <div className="sm:col-span-2"><SelectField name="state" label="State" defaultValue={branch?.state} options={[{ value: "", label: "Select a state or federal territory" }, ...malaysianStates]} /></div>
      </FormSection>
      <FormSection title="Coach">
        <TextField name="coach_name" label="Coach name" defaultValue={branch?.coach_name} maxLength={120} autoComplete="off" hint="Optional" />
        <TextField name="coach_role" label="Coach role / title" defaultValue={branch?.coach_role} maxLength={80} autoComplete="off" placeholder="e.g. Head Coach" />
        <TextField name="coach_phone" label="Coach phone" type="tel" defaultValue={branch?.coach_phone} maxLength={20} autoComplete="off" hint="Optional, e.g. 012-345 6789" />
        <TextField name="coach_email" label="Coach email" type="email" defaultValue={branch?.coach_email} maxLength={254} autoComplete="off" hint="Optional" />
      </FormSection>
    </>
  );
}

/** Full-page branch form (Add branch page and Edit branch). */
export function BranchForm({ action, cancelHref, branch, branchId, palette, submit }: { action: FormAction; cancelHref: string; branch?: BranchDetails; branchId?: string; palette: BranchPalette; submit: string }) {
  return (
    <ActionForm action={action} schema={branchSchema} submit={submit} footer={<Link href={cancelHref} className={buttonVariants({ variant: "ghost" })}>Cancel</Link>}>
      <BranchFields branch={branch} branchId={branchId} palette={palette} />
    </ActionForm>
  );
}

/**
 * Branch modal shell: ~820px on desktop (still `calc(100% - 2rem)` on smaller screens, at most 90%
 * of the window height), header fixed, fields scrolling, actions pinned. On phones it floats with
 * 12px margins instead of the edge-to-edge bottom sheet.
 */
const BRANCH_MODAL = "sm:max-w-[820px] max-sm:inset-x-3 max-sm:bottom-3 max-sm:w-auto max-sm:max-h-[calc(100dvh-1.5rem)] max-sm:rounded-2xl";

/** "Add branch" button plus the Add branch modal (same FormDialog/Modal as Add student). */
export function AddBranchDialog({ action, clubName, palette }: { action: FormAction; clubName: string; palette: BranchPalette }) {
  return (
    <FormDialog label="Add branch" title="Add branch" description={<>Add a training location for {clubName}.</>} modalClassName={BRANCH_MODAL} scrollBody>
      <AddBranchForm action={action} palette={palette} />
    </FormDialog>
  );
}

function AddBranchForm({ action, palette }: { action: FormAction; palette: BranchPalette }) {
  const { close } = useFormDialog();
  return (
    <ActionForm action={action} schema={branchSchema} submit="Add branch" layout="dialog" footer={<Button type="button" variant="ghost" onClick={close}>Cancel</Button>}>
      <SaveWatcher />
      <BranchFields palette={palette} />
    </ActionForm>
  );
}

const updatedNotice = (): Record<string, string> => ({ notice: "updated" });

/**
 * "Edit" button plus the Edit branch modal (same FormDialog and fields as Add branch), prefilled
 * with the branch's saved details. Saving updates the branch and refreshes the list in place.
 */
export function EditBranchDialog({ clubId, branch, palette }: { clubId: string; branch: BranchDetails & { id: string }; palette: BranchPalette }) {
  return (
    <FormDialog
      label="Edit"
      title="Edit branch"
      description={<>Update {branch.name}&apos;s details.</>}
      noticeParams={updatedNotice}
      modalClassName={BRANCH_MODAL}
      scrollBody
      trigger={{ icon: "pencil", variant: "outline", size: "sm", ariaLabel: `Edit ${branch.name}` }}
    >
      <EditBranchForm clubId={clubId} branch={branch} palette={palette} />
    </FormDialog>
  );
}

function EditBranchForm({ clubId, branch, palette }: { clubId: string; branch: BranchDetails & { id: string }; palette: BranchPalette }) {
  const { close } = useFormDialog();
  const action = useMemo(() => editBranch.bind(null, clubId, branch.id), [clubId, branch.id]);
  return (
    <ActionForm action={action} schema={branchSchema} submit="Save changes" layout="dialog" footer={<Button type="button" variant="ghost" onClick={close}>Cancel</Button>}>
      <SaveWatcher />
      <BranchFields branch={branch} branchId={branch.id} palette={palette} />
    </ActionForm>
  );
}
