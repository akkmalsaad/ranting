import { redirect } from "next/navigation";
import { listMyClubs } from "@/lib/clubs";
export const dynamic = "force-dynamic";
/** Post-login entry: new users set up a club; members go to their club dashboard. */
export default async function Workspaces() {
  const { clubs } = await listMyClubs();
  redirect(clubs.length ? `/clubs/${clubs[0].id}` : "/workspaces/new");
}
