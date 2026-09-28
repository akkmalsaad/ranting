import { Wallet } from "lucide-react";
import { requireClub } from "@/lib/clubs";
import { ComingSoon } from "@/components/coming-soon";
export const metadata = { title: "Fees" };
export default async function Fees({ params }: PageProps<"/clubs/[clubId]/fees">) {
  await requireClub((await params).clubId);
  return <ComingSoon title="Fees" icon={Wallet} body="Monthly fees and payment tracking are planned for a later release. No fees or payments are recorded yet." />;
}
