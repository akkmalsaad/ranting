"use client";
import { ActionForm, type FormAction } from "@/components/action-form";
import { TextField } from "@/components/field";
import { DisciplineField } from "@/components/clubs/discipline-field";
import { clubSchema } from "@/lib/validation";

/** Onboarding step 1: the required club details. */
export function ClubForm({ action, submit = "Continue", footer }: { action: FormAction; submit?: string; footer?: React.ReactNode }) {
  return (
    <ActionForm action={action} schema={clubSchema} submit={submit} footer={footer}>
      <TextField name="name" label="Club name" required minLength={2} maxLength={120} autoComplete="organization" placeholder="e.g. Seni Gayung Harimau" autoFocus />
      <DisciplineField />
    </ActionForm>
  );
}
