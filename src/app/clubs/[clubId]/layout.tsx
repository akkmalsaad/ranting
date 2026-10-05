import { listMyClubs, requireClub } from "@/lib/clubs";
import { ClubSidebar, RantingBrand } from "@/components/clubs/club-sidebar";
import { MobileNavDrawer } from "@/components/clubs/mobile-nav-drawer";

/**
 * Authenticated club shell. Desktop (lg+): a navy frame holding the sticky sidebar and a large
 * rounded off-white workspace. Below lg: a compact navy top bar whose menu opens the same
 * sidebar content in a slide-in drawer, so pages keep the full width.
 */
export default async function ClubLayout({ children, params }: LayoutProps<"/clubs/[clubId]">) {
  const { clubId } = await params;
  const [{ club }, { clubs }] = await Promise.all([requireClub(clubId), listMyClubs()]);
  const home = `/clubs/${club.id}`;
  return (
    <div className="min-h-dvh bg-navy lg:flex">
      <header className="shell-dark sticky top-0 z-40 flex h-14 items-center justify-between gap-3 bg-navy pl-4 pr-2 lg:hidden">
        <RantingBrand href={home} />
        <MobileNavDrawer brand={<RantingBrand href={home} />}><ClubSidebar club={club} clubs={clubs} /></MobileNavDrawer>
      </header>
      <aside className="shell-dark sticky top-0 hidden h-dvh w-64 shrink-0 flex-col overflow-y-auto px-4 pb-6 pt-7 lg:flex">
        <div className="px-1"><RantingBrand href={home} /></div>
        <ClubSidebar club={club} clubs={clubs} />
      </aside>
      <div className="min-w-0 flex-1 lg:py-3 lg:pr-3">
        <main className="min-h-[calc(100dvh-3.5rem)] rounded-t-[1.25rem] bg-background lg:min-h-[calc(100dvh-1.5rem)] lg:rounded-[1.75rem]">
          <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-10 lg:py-10">{children}</div>
        </main>
      </div>
    </div>
  );
}
