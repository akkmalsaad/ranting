import { requireClub } from "@/lib/clubs";
import { PageHeader } from "@/components/page-header";
import { Notice } from "@/components/notice";
import { ClubSettingsForm } from "@/components/clubs/club-profile-form";
import { clubLogoSrc } from "@/components/clubs/club-logo";
import { updateClubSettings } from "./actions";

export const metadata = { title: "Club settings" };

export default async function ClubSettings({ params, searchParams }: PageProps<"/clubs/[clubId]/settings">) {
  const { clubId } = await params;
  const [{ club }, { notice }] = await Promise.all([requireClub(clubId), searchParams]);
  return (
    <>
      <PageHeader title="Club settings" description="Your club's details, registration and contact information." />
      <Notice code={notice} messages={{ saved: "Club details saved." }} />
      <section className="panel max-w-3xl">
        <ClubSettingsForm action={updateClubSettings.bind(null, club.id)} club={club} logoSrc={clubLogoSrc(club)} />
      </section>
    </>
  );
}
