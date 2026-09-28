import type { NextRequest } from "next/server";
import { requireUser } from "@/lib/supabase/server";
import { idSchema } from "@/lib/validation";

/**
 * Club logo for <img> tags. Members get a redirect to a 60-second signed URL; everyone else
 * gets 404. The club lookup and the signed URL both go through RLS with the user's session,
 * and the page render never waits on Storage.
 */
export async function GET(_: NextRequest, { params }: RouteContext<"/clubs/[clubId]/logo">) {
  const { clubId } = await params;
  const notFound = () => new Response("Not found", { status: 404, headers: { "Cache-Control": "private, no-store" } });
  if (!idSchema.safeParse(clubId).success) return notFound();
  const { db } = await requireUser();
  const { data: club } = await db.from("clubs").select("logo_path").eq("id", clubId).maybeSingle();
  if (!club?.logo_path) return notFound();
  const { data } = await db.storage.from("club-logos").createSignedUrl(club.logo_path, 60);
  if (!data?.signedUrl) return notFound();
  return new Response(null, { status: 302, headers: { Location: data.signedUrl, "Cache-Control": "private, no-store" } });
}
