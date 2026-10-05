import Image from "next/image";
import Link from "next/link";
import { LogOut, Plus } from "lucide-react";
import { assets } from "@/lib/assets";
import { signOut } from "@/app/auth/actions";
import { ClubNav } from "@/components/clubs/club-nav";
import { ClubSwitcher } from "@/components/clubs/club-switcher";
import { ClubLogo } from "@/components/clubs/club-logo";

type SidebarClub = { id: string; name: string; discipline: string; logo_path: string | null };

/**
 * Ranting product mark for the navy shell. The approved icon is navy on transparent, so it sits
 * unmodified on a white tile; the product name is set beside it.
 */
export function RantingBrand({ href }: { href: string }) {
  return (
    <Link href={href} className="flex w-fit items-center gap-2.5 rounded-xl">
      <span className="grid size-9 shrink-0 place-items-center rounded-[0.7rem] bg-white">
        <Image src={assets.icon} alt="" className="size-7" priority />
      </span>
      <span className="text-[1.0625rem] font-bold tracking-[-0.02em] text-white">Ranting</span>
    </Link>
  );
}

/** Everything below the brand: club identity, navigation and account actions. Used by the desktop sidebar and the mobile drawer. */
export function ClubSidebar({ club, clubs }: { club: SidebarClub; clubs: { id: string; name: string }[] }) {
  const footerLink = "flex min-h-10 w-full items-center gap-3 rounded-full px-4 text-sm font-medium text-white/65 transition-colors hover:bg-white/[0.06] hover:text-white";
  return (
    <div className="flex flex-1 flex-col">
      <div className="mt-7 flex items-center gap-3 rounded-2xl bg-white/[0.06] p-3">
        <ClubLogo club={club} className="size-10 shrink-0 rounded-xl bg-white object-cover" />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-white">{club.name}</p>
          <p className="truncate text-xs text-white/60">{club.discipline}</p>
        </div>
      </div>
      {clubs.length > 1 && <div className="mt-3"><ClubSwitcher clubs={clubs} currentId={club.id} tone="dark" /></div>}

      <div className="mt-7 flex-1"><ClubNav clubId={club.id} /></div>

      <div className="mt-8 space-y-1 border-t border-white/[0.08] pt-4">
        <Link href="/workspaces/new" className={footerLink}><Plus size={18} strokeWidth={1.75} aria-hidden /> Create another club</Link>
        <form action={signOut}><button type="submit" className={footerLink}><LogOut size={18} strokeWidth={1.75} aria-hidden /> Sign out</button></form>
      </div>
    </div>
  );
}
