"use client";
import { ActionForm, type FormAction } from "@/components/action-form";
import { TextField } from "@/components/field";
import { clubSchema } from "@/lib/validation";

// Suggestions only: clubs can enter any discipline.
const disciplines = ["Silat", "Taekwondo", "Brazilian Jiu-Jitsu", "Muay Thai", "Karate", "Judo", "Wushu"];

export function ClubForm({ action }: { action: FormAction }) {
  return (
    <ActionForm action={action} schema={clubSchema} submit="Create club">
      <TextField name="name" label="Club name" required minLength={2} maxLength={120} autoComplete="organization" placeholder="e.g. Seni Gayung Harimau" />
      <TextField name="discipline" label="Martial art" required minLength={2} maxLength={80} list="disciplines" hint="Choose a suggestion or type your own." />
      <datalist id="disciplines">{disciplines.map((d) => <option key={d} value={d} />)}</datalist>
    </ActionForm>
  );
}
