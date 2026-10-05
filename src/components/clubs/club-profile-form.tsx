"use client";
import Link from "next/link";
import { ActionForm, type FormAction } from "@/components/action-form";
import { Button, buttonVariants } from "@/components/ui/button";
import { FormDialog, SaveWatcher, useFormDialog } from "@/components/form-dialog";
import { TextField } from "@/components/field";
import { ClubProfileFields } from "@/components/clubs/club-profile-fields";
import { DisciplineField } from "@/components/clubs/discipline-field";
import { clubProfileSchema, clubSettingsSchema } from "@/lib/validation";
import type { Club } from "@/lib/clubs";

/**
 * Onboarding step 2: every field optional; "Skip for now" leaves the profile empty.
 * Also reused (prefilled, with its own submit label and footer) by the dashboard's Complete profile.
 */
export function ClubProfileForm({ action, skipHref, club, logoSrc, submit = "Finish", footer, children }: { action: FormAction; skipHref?: string; club?: Club; logoSrc?: string | null; submit?: string; footer?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <ActionForm action={action} schema={clubProfileSchema} submit={submit} footer={footer ?? (skipHref && <Link href={skipHref} className={buttonVariants({ variant: "ghost" })}>Skip for now</Link>)}>
      {children}
      <ClubProfileFields club={club} logoSrc={logoSrc} />
    </ActionForm>
  );
}

/**
 * Dashboard "Complete profile": the onboarding profile form in the shared modal, prefilled with the
 * club's saved details (and logo). Saves to the existing club; Cancel/X close without saving.
 */
export function EditClubProfileDialog({ action, club, logoSrc }: { action: FormAction; club: Club; logoSrc: string | null }) {
  return (
    <FormDialog
      label="Complete profile"
      title="Complete your club profile"
      description="Registration, address and contact details help parents and associations recognise your club."
      noticeParams={() => ({})}
      modalClassName="sm:max-w-xl"
      trigger={{ icon: "none", variant: "ghost", className: "min-h-0 px-2 py-1 font-semibold text-primary hover:bg-primary/5 hover:underline" }}
    >
      <EditClubProfileForm action={action} club={club} logoSrc={logoSrc} />
    </FormDialog>
  );
}

function EditClubProfileForm({ action, club, logoSrc }: { action: FormAction; club: Club; logoSrc: string | null }) {
  const { close } = useFormDialog();
  return (
    <ClubProfileForm action={action} club={club} logoSrc={logoSrc} submit="Save changes" footer={<Button type="button" variant="ghost" onClick={close}>Cancel</Button>}>
      <SaveWatcher />
    </ClubProfileForm>
  );
}

/** Club Settings: required details plus the full optional profile. */
export function ClubSettingsForm({ action, club, logoSrc }: { action: FormAction; club: Club; logoSrc: string | null }) {
  return (
    <ActionForm action={action} schema={clubSettingsSchema} submit="Save changes">
      <fieldset className="form-section grid gap-5 sm:grid-cols-2">
        <legend className="form-legend">Club</legend>
        <TextField name="name" label="Club name" defaultValue={club.name} required minLength={2} maxLength={120} autoComplete="organization" />
        <DisciplineField defaultValue={club.discipline} />
      </fieldset>
      <ClubProfileFields club={club} logoSrc={logoSrc} />
      {club.logo_path && <label className="flex w-fit cursor-pointer items-center gap-2.5 font-medium"><input type="checkbox" name="remove_logo" className="size-4" /> Remove the current logo</label>}
    </ActionForm>
  );
}
