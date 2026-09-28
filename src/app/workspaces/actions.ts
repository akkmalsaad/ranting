"use server";
import { redirect } from "next/navigation";
import type { FormState } from "@/lib/forms";
import { parseForm } from "@/lib/forms";
import { requireUser } from "@/lib/supabase/server";
import { clubSchema } from "@/lib/validation";

export async function createClub(_: FormState, form: FormData): Promise<FormState> {
  const { db } = await requireUser();
  const parsed = parseForm(clubSchema, form);
  if (!parsed.ok) return parsed.state;
  // create_club inserts the club and the caller's owner membership in one transaction.
  const { data: clubId, error } = await db.rpc("create_club", { p_name: parsed.data.name, p_discipline: parsed.data.discipline });
  if (error || !clubId) return { error: "We couldn't create your club. Please try again.", values: parsed.values };
  redirect(`/clubs/${clubId}?welcome=1`);
}
