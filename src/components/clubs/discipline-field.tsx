"use client";
import { TextField } from "@/components/field";

// Suggestions only: clubs can enter any martial art style.
const disciplines = ["Silat", "Taekwondo", "Brazilian Jiu-Jitsu", "Muay Thai", "Karate", "Judo", "Wushu"];

export function DisciplineField({ defaultValue }: { defaultValue?: string }) {
  return (
    <>
      <TextField name="discipline" label="Martial art style" defaultValue={defaultValue} required minLength={2} maxLength={80} list="disciplines" hint="Choose a suggestion or type your own." />
      <datalist id="disciplines">{disciplines.map((d) => <option key={d} value={d} />)}</datalist>
    </>
  );
}
