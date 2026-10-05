import { notFound } from "next/navigation";
import { requireClub } from "@/lib/clubs";
import { branchScope, financeSummary } from "@/lib/finance/queries";
import { todayInMalaysia } from "@/lib/validation";
import { PageHeader } from "@/components/page-header";
import { TransactionForm } from "@/components/finance/transaction-form";
import { loadClubCategories } from "@/lib/club-settings";
import { recordTransaction } from "../actions";
export const metadata = { title: "Record transaction" };
export default async function NewTransaction({params,searchParams}:PageProps<"/clubs/[clubId]/finances/new">) {
  const {clubId}=await params; const sp=await searchParams;
  const kind=sp.kind ?? "income";
  if(kind!=="income" && kind!=="expense") notFound();
  const [{club},scope,summary,{categories}]=await Promise.all([requireClub(clubId),branchScope(clubId,sp.branch),financeSummary(clubId),loadClubCategories(clubId)]);
  const base=`/clubs/${club.id}/finances`;
  return <><PageHeader title={kind==="income" ? "Record payment received" : "Record an expense"} description={`${club.name} · Manual MYR records`} back={{ href: base, label: "Back to Finance" }} />
    <div className="panel max-w-2xl">{summary.state === "ready" ? <TransactionForm action={recordTransaction.bind(null,club.id)} requestId={crypto.randomUUID()} kind={kind} today={todayInMalaysia()} branchId={scope.selected?.archived_at ? "" : scope.id} branches={scope.options.filter((b)=>!b.archived_at)} categories={categories}/> : <p role="status">Unable to load financial tracking. Please reload and try again.</p>}</div></>;
}
