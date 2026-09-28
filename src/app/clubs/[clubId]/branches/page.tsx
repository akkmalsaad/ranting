import Image from "next/image";
import Link from "next/link";
import { MapPin, Pencil, Plus } from "lucide-react";
import { assets } from "@/lib/assets";
import { clubClient, requireClub } from "@/lib/clubs";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import { ViewTabs } from "@/components/view-tabs";
import { Notice } from "@/components/notice";

export const metadata = { title: "Branches" };
const notices = { created: "Branch added.", updated: "Branch updated.", archived: "Branch archived.", restored: "Branch restored." };

export default async function Branches({ params, searchParams }: PageProps<"/clubs/[clubId]/branches">) {
  const { clubId } = await params;
  const { view, notice } = await searchParams;
  const archived = view === "archived";
  const { db } = await clubClient(clubId);
  let query = db.from("branches").select("id, name, address, archived_at").eq("club_id", clubId).order("name").limit(200);
  query = archived ? query.not("archived_at", "is", null) : query.is("archived_at", null);
  // Membership check and the RLS-scoped list run in parallel.
  const [{ club }, { data: branches, error }] = await Promise.all([requireClub(clubId), query]);
  const base = `/clubs/${club.id}/branches`;
  if (error) throw new Error("Unable to load branches.");
  return (
    <>
      <PageHeader title="Branches" description="The locations where your club trains." actions={<Button asChild><Link href={`${base}/new`}><Plus size={16} aria-hidden /> Add branch</Link></Button>} />
      <Notice code={notice} messages={notices} />
      <ViewTabs label="Branch status" tabs={[{ href: base, label: "Active", active: !archived }, { href: `${base}?view=archived`, label: "Archived", active: archived }]} />
      {branches.length === 0 ? (
        <section className="panel flex flex-col items-center py-12 text-center">
          <Image src={assets.emptyBranches} alt="" className="h-auto w-40" />
          <h2 className="mt-6">{archived ? "No archived branches" : "No branches yet"}</h2>
          <p className="mt-2 max-w-sm text-sm text-slate-600">{archived ? "Branches you archive will appear here and can be restored." : "Add your first branch so you can place students there."}</p>
        </section>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {branches.map((b) => (
            <li key={b.id} className="panel flex items-start gap-4">
              <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary"><MapPin size={20} aria-hidden /></span>
              <div className="min-w-0 flex-1">
                <h2 className="break-words">{b.name}</h2>
                <p className="mt-1 whitespace-pre-line break-words text-sm text-slate-600">{b.address || "No address added"}</p>
                {b.archived_at && <p className="mt-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Archived</p>}
              </div>
              <Button asChild variant="outline" className="min-h-10 px-3 py-2"><Link href={`${base}/${b.id}/edit`} aria-label={`Edit ${b.name}`}><Pencil size={16} aria-hidden /> Edit</Link></Button>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
