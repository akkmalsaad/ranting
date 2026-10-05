/**
 * Remounts when the top-level club section changes (Dashboard → Students → Finance…), not for
 * deeper navigation or search-param changes, so the enter animation marks a change of section.
 * It wraps loading.tsx: the skeleton (or page) eases in while data streams as before; navigation
 * is never delayed. The animation ends at no transform (fill mode `backwards`), so fixed-position
 * descendants aren't affected once it finishes. Disabled for prefers-reduced-motion (globals.css).
 */
export default function ClubTemplate({ children }: { children: React.ReactNode }) {
  return <div className="page-enter">{children}</div>;
}
