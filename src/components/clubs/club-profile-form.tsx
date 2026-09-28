"use client";
import Link from "next/link";
import { ActionForm, type FormAction } from "@/components/action-form";
import { TextField } from "@/components/field";
import { ClubProfileFields } from "@/components/clubs/club-profile-fields";
import { DisciplineField } from "@/components/clubs/discipline-field";
import { clubProfileSchema, clubSettingsSchema } from "@/lib/validation";
import type { Club } from "@/lib/clubs";

/** Onboarding step 2: every field optional; "Skip for now" leaves the profile empty. */
export function ClubProfileForm({ action, skipHref }: { action: FormAction; skipHref: string }) {
  return (
    <ActionForm action={action} schema={clubProfileSchema} submit="Finish" footer={<Link href={skipHref} className="px-3 text-sm font-semibold text-slate-600 hover:underline">Skip for now</Link>}>
      <ClubProfileFields />
    </ActionForm>
  );
}

/** Club Settings: required details plus the full optional profile. */
export function ClubSettingsForm({ action, club, logoSrc }: { action: FormAction; club: Club; logoSrc: string | null }) {
  return (
    <ActionForm action={action} schema={clubSettingsSchema} submit="Save changes">
      <fieldset className="grid gap-5 sm:grid-cols-2">
        <legend className="mb-4 text-base font-bold">Club</legend>
        <TextField name="name" label="Club name" defaultValue={club.name} required minLength={2} maxLength={120} autoComplete="organization" />
        <DisciplineField defaultValue={club.discipline} />
      </fieldset>
      <ClubProfileFields club={club} logoSrc={logoSrc} />
      {club.logo_path && <label className="flex items-center gap-2 font-medium"><input type="checkbox" name="remove_logo" className="size-4" /> Remove the current logo</label>}
    </ActionForm>
  );
}
