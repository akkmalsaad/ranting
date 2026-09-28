import Image from "next/image";
import { assets } from "@/lib/assets";

/** Authorized logo URL (redirects to a short-lived signed URL); the path in `v` busts caches on change. */
export function clubLogoSrc(club: { id: string; logo_path: string | null }) {
  return club.logo_path ? `/clubs/${club.id}/logo?v=${encodeURIComponent(club.logo_path.split("/").pop() ?? "")}` : null;
}

export function ClubLogo({ club, className }: { club: { id: string; logo_path: string | null }; className?: string }) {
  const src = clubLogoSrc(club);
  return src
    ? <Image src={src} alt="" width={40} height={40} unoptimized className={className} />
    : <Image src={assets.club} alt="" className={className} />;
}
