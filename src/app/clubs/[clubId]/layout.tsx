import Image from "next/image";
import Link from "next/link";
import { Plus } from "lucide-react";
import { assets } from "@/lib/assets";
import { listMyClubs, requireClub } from "@/lib/clubs";
import { signOut } from "@/app/login/actions";
import { Button } from "@/components/ui/button";
import { ClubNav } from "@/components/clubs/club-nav";
import { ClubSwitcher } from "@/components/clubs/club-switcher";

export default async function ClubLayout({ children, params }: LayoutProps<"/clubs/[clubId]">) {
  const { clubId } = await params;
  const { club } = await requireClub(clubId);
  const { clubs } = await listMyClubs();
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[260px_1fr]">
      <aside className="border-b border-border bg-white px-4 pb-3 pt-4 lg:sticky lg:top-0 lg:h-screen lg:border-b-0 lg:border-r lg:p-6">
        <div className="flex items-center justify-between gap-4 lg:block">
          <Link href={`/clubs/${club.id}`}><Image src={assets.banner} alt="Ranting" className="h-auto w-32 lg:w-36" priority /></Link>
          <form action={signOut} className="lg:hidden"><Button variant="ghost" className="min-h-9 px-3 py-2">Sign out</Button></form>
        </div>
        <div className="my-4 flex items-center gap-3 lg:my-8">
          <Image src={assets.club} alt="" className="size-10 rounded-xl object-cover" />
          <div className="min-w-0">
            <p className="truncate font-semibold">{club.name}</p>
            <p className="truncate text-xs text-slate-500">{club.discipline}</p>
          </div>
        </div>
        <ClubNav clubId={club.id} />
        <div className="mt-8 hidden space-y-4 lg:block">
          {clubs.length > 1 && <ClubSwitcher clubs={clubs} currentId={club.id} />}
          <Link href="/workspaces/new" className="flex items-center gap-2 text-sm font-medium text-primary hover:underline"><Plus size={16} aria-hidden /> Create another club</Link>
          <form action={signOut}><Button variant="outline" className="w-full">Sign out</Button></form>
        </div>
        {clubs.length > 1 && <div className="mt-3 lg:hidden"><ClubSwitcher clubs={clubs} currentId={club.id} /></div>}
      </aside>
      <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-10 lg:py-10">{children}</main>
    </div>
  );
}
