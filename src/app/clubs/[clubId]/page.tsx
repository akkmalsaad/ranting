import Image from "next/image";
import Link from "next/link";
import { MapPin, Plus, Users } from "lucide-react";
import { assets } from "@/lib/assets";
import { requireClub } from "@/lib/clubs";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";

export const metadata = { title: "Dashboard" };

export default async function Dashboard({ params }: PageProps<"/clubs/[clubId]">) {
  const { clubId } = await params;
  const { db, club } = await requireClub(clubId);
  const [branches, students] = await Promise.all([
    db.from("branches").select("id", { count: "exact", head: true }).eq("club_id", club.id).is("archived_at", null),
    db.from("students").select("id", { count: "exact", head: true }).eq("club_id", club.id).eq("status", "active").is("archived_at", null),
  ]);
  if (branches.error || students.error) throw new Error("Unable to load club summary.");
  const base = `/clubs/${club.id}`;
  const stats = [
    { label: "Active branches", value: branches.count ?? 0, href: `${base}/branches`, icon: MapPin },
    { label: "Active students", value: students.count ?? 0, href: `${base}/students`, icon: Users },
  ];
  return (
    <>
      <PageHeader title={club.name} description={`${club.discipline} · Club overview`} />
      <div className="grid gap-4 sm:grid-cols-2">
        {stats.map(({ label, value, href, icon: Icon }) => (
          <Link key={label} href={href} className="panel flex items-center gap-4 transition-shadow hover:shadow-md">
            <span className="grid size-12 place-items-center rounded-2xl bg-primary/10 text-primary"><Icon aria-hidden /></span>
            <span><span className="block text-3xl font-bold tracking-tight">{value}</span><span className="text-sm text-slate-600">{label}</span></span>
          </Link>
        ))}
      </div>
      {branches.count === 0 ? (
        <EmptyStep image={assets.emptyBranches} title="Add your first branch" body="Branches are the locations where your club trains. Add one so you can place students there." href={`${base}/branches/new`} cta="Add branch" />
      ) : students.count === 0 ? (
        <EmptyStep image={assets.emptyStudents} title="Add your first student" body="Register students with their guardian contacts and branch." href={`${base}/students/new`} cta="Add student" />
      ) : (
        <section className="panel mt-6">
          <h2>Quick actions</h2>
          <div className="mt-4 flex flex-wrap gap-3">
            <Button asChild><Link href={`${base}/students/new`}><Plus size={16} aria-hidden /> Add student</Link></Button>
            <Button asChild variant="outline"><Link href={`${base}/branches/new`}><Plus size={16} aria-hidden /> Add branch</Link></Button>
          </div>
        </section>
      )}
    </>
  );
}

function EmptyStep({ image, title, body, href, cta }: { image: typeof assets.emptyBranches; title: string; body: string; href: string; cta: string }) {
  return (
    <section className="panel mt-6 flex flex-col items-center gap-6 text-center sm:flex-row sm:text-left">
      <Image src={image} alt="" className="h-auto w-36 shrink-0" />
      <div>
        <h2>{title}</h2>
        <p className="mb-5 mt-2 max-w-md text-sm leading-6 text-slate-600">{body}</p>
        <Button asChild><Link href={href}><Plus size={16} aria-hidden /> {cta}</Link></Button>
      </div>
    </section>
  );
}
