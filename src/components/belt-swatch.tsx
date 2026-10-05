import { describeBelt } from "@/lib/validation";

// Original belt drawing (viewBox 44 × 26): a waistband behind a central knot, with two ends hanging
// diagonally downward. Every piece is filled with the base colour and outlined in a subtle dark
// stroke, so white and pale belts stay visible on light backgrounds.
const OUTLINE = { stroke: "#0f172a", strokeOpacity: 0.45, strokeWidth: 1.1, strokeLinejoin: "round" as const };
// Each end is a constant-width strip (4 units) at 42° below the waistband, long enough to fit the
// stripe bands below the knot.
const LEFT_END = "M19.06 7.91 L21.74 10.89 L5.76 25.27 L3.08 22.30 Z";
const RIGHT_END = "M24.94 7.91 L22.26 10.89 L38.24 25.27 L40.92 22.30 Z";
// Three bands across the right end towards its tip (a fixed visual style, not a rank count).
// Each is 4.45 units thick (≈3.9 px at the default size) with 1.1-unit gaps, and its corners lie
// exactly on the end's long edges, so it stays inside the belt shape.
const STRIPE_BANDS = [
  "M28.99 11.56 L26.31 14.53 L29.62 17.51 L32.30 14.54 Z",
  "M33.11 15.27 L30.44 18.25 L33.74 21.22 L36.42 18.25 Z",
  "M37.24 18.99 L34.56 21.96 L37.87 24.94 L40.54 21.97 Z",
];

/**
 * The one belt indicator used everywhere (Settings, student profile, level selectors).
 * `stripe` adds three bands in that colour near the tip of the right end. Decorative by default
 * (the level name is shown beside it); `labelled` makes it an image describing its colours,
 * e.g. "white belt with a green stripe".
 */
export function BeltSwatch({ color, stripe, labelled = false, className = "" }: { color: string; stripe?: string | null; labelled?: boolean; className?: string }) {
  return (
    <svg
      viewBox="0 0 44 26"
      fill="none"
      className={`h-[23px] w-[39px] shrink-0 ${className}`}
      {...(labelled ? { role: "img", "aria-label": describeBelt(color, stripe) } : { "aria-hidden": true })}
    >
      {/* Waistband, behind the knot */}
      <rect x="1" y="3.6" width="42" height="5.8" rx="2" fill={color} {...OUTLINE} />
      {/* Hanging ends */}
      <path d={LEFT_END} fill={color} {...OUTLINE} />
      <path d={RIGHT_END} fill={color} {...OUTLINE} />
      {stripe && (
        <>
          {STRIPE_BANDS.map((d) => <path key={d} d={d} fill={stripe} />)}
          {/* Re-draw the end's outline over the band ends for a clean edge. */}
          <path d={RIGHT_END} {...OUTLINE} />
        </>
      )}
      {/* Knot with a fold crease */}
      <rect x="17.4" y="1.4" width="9.2" height="10.2" rx="2.3" fill={color} {...OUTLINE} />
      <path d="M19.3 3.6 Q22 6.4 24.7 9.4" stroke="#0f172a" strokeOpacity="0.3" strokeWidth="0.9" strokeLinecap="round" />
    </svg>
  );
}

/** Level name with its belt; screen readers also hear the colours. "(archived)" when retired. */
export function BeltBadge({ name, color, stripe, archived = false }: { name: string; color: string; stripe?: string | null; archived?: boolean }) {
  return (
    <span className="inline-flex max-w-full items-center gap-2">
      <BeltSwatch color={color} stripe={stripe} />
      <span className="min-w-0 break-words">
        {name}
        <span className="sr-only"> ({describeBelt(color, stripe)})</span>
        {archived && <span className="text-slate-500"> (archived)</span>}
      </span>
    </span>
  );
}
