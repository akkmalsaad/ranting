import { CalendarDays } from "lucide-react";
import { requireClub } from "@/lib/clubs";
import { ComingSoon } from "@/components/coming-soon";
export const metadata = { title: "Classes" };
export default async function Classes({ params }: PageProps<"/clubs/[clubId]/classes">) {
  await requireClub((await params).clubId);
  return <ComingSoon title="Classes" icon={CalendarDays} body="Recurring class schedules and attendance are planned for a later release. No class data is recorded yet." />;
}
