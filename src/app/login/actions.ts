"use server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import type { FormState } from "@/components/action-form";
export async function signIn(_: FormState, form: FormData): Promise<FormState> {
  const result = z.object({email:z.email(),password:z.string().min(1).max(128)}).safeParse(Object.fromEntries(form));
  if (!result.success) return {error:"Enter a valid email address and password."};
  const db = await createClient();
  const {error} = await db.auth.signInWithPassword(result.data);
  if (error) return {error:"Unable to sign in. Check your email and password, and confirm your account is activated."};
  redirect("/workspaces");
}
export async function signOut() {
  const db = await createClient();
  const {error} = await db.auth.signOut();
  if(error) throw new Error("Unable to sign out. Please try again.");
  redirect("/login");
}
