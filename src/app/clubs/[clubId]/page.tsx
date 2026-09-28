import Image from "next/image";
import Link from "next/link";
import { ClipboardList, MapPin, Plus, Users } from "lucide-react";
import { assets } from "@/lib/assets";
import { clubClient, requireClub } from "@/lib/clubs";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import { Modal } from "@/components/ui/modal";
import { ClubProfileForm } from "@/components/clubs/club-profile-form";
import { completeClubProfile } from "./settings/actions";
import type { Club } from "@/lib/clubs";

export const metadata = { title: "Dashboard" };

export default async function Dashboard({ params, searchParams }: PageProps<"/clubs/[clubId]">) {
  const { clubId } = await params;
  const welcome = (await searchParams).welcome === "1";
  const { db } = await clubClient(clubId);
  // Membership check and RLS-scoped counts run in one parallel round trip.
  const [{ club }, branches, students] = await Promise.all([
    requireClub(clubId),
    db.from("branches").select("id", { count: "exact", head: true }).eq("club_id", clubId).is("archived_at", null),
    db.from("students").select("id", { count: "exact", head: true }).eq("club_id", clubId).eq("status", "active").is("archived_at", null),
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
      {!welcome && <ProfileCard club={club} href={`${base}/settings`} />}
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
      {welcome && (
        <Modal labelledBy="profile-title">
          <p className="text-sm font-bold uppercase tracking-[.18em] text-primary">Step 2 of 2 · Optional</p>
          <h1 id="profile-title" className="mt-2 !text-3xl">Add your club details</h1>
          <p className="mb-6 mt-2 text-slate-600">Registration, address and contact details help parents and associations recognise your club. You can add or change these later in Settings.</p>
          <ClubProfileForm action={completeClubProfile.bind(null, club.id)} skipHref={base} />
        </Modal>
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

/** Optional profile sections still empty, in the order they appear in Settings. */
function missingProfile(club: Club) {
  return [
    !club.ros_number && !club.sports_commissioner_number && !club.ssm_number && "registration numbers",
    !club.association && "affiliation",
    !(club.address_line1 && club.postcode && club.city && club.state) && "address",
    !(club.phone || club.email) && "contact details",
    !club.year_founded && "year founded",
    !club.logo_path && "logo",
  ].filter((item): item is string => !!item);
}

function ProfileCard({ club, href }: { club: Club; href: string }) {
  const missing = missingProfile(club);
  if (!missing.length) return null;
  return (
    <section className="panel mb-6 flex flex-col gap-4 border-primary/30 bg-primary/5 sm:flex-row sm:items-center">
      <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-white text-primary"><ClipboardList aria-hidden /></span>
      <div className="flex-1">
        <h2>Complete your club profile</h2>
        <p className="mt-1 text-sm text-slate-600">Still to add: {missing.join(", ")}.</p>
      </div>
      <Button asChild variant="outline"><Link href={href}>Complete profile</Link></Button>
    </section>
  );
}

