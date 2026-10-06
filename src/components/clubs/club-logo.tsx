import Image from "next/image";
import { assets } from "@/lib/assets";
import { cn } from "@/lib/utils";

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

/**
 * The club's identity mark in a square, rounded white tile (size it with `className`, e.g. size-13).
 * An uploaded logo is shown whole (object-contain, a little inner padding): never cropped or
 * stretched, and transparent logos sit on white. Without a logo it shows the existing club
 * placeholder, filling the tile as before. Decorative: the club name is always shown beside it.
 */
export function ClubLogoTile({ club, className, sizes = "64px" }: { club: { id: string; logo_path: string | null }; className?: string; sizes?: string }) {
  const src = clubLogoSrc(club);
  return (
    <span className={cn("grid shrink-0 place-items-center overflow-hidden rounded-xl bg-white ring-1 ring-inset ring-black/[0.06]", src && "p-1", className)}>
      {src
        ? <Image src={src} alt="" width={128} height={128} unoptimized className="size-full object-contain" />
        : <Image src={assets.club} alt="" sizes={sizes} className="size-full object-cover" />}
    </span>
  );
}
