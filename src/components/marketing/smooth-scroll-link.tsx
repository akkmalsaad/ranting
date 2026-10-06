"use client";

/**
 * In-page link (href="#id") that scrolls smoothly to its section, or jumps for reduced motion, then
 * moves focus there for keyboard and screen-reader users. Without JavaScript it's a plain anchor.
 * The target should have tabIndex={-1} and a scroll margin for the sticky header.
 */
export function SmoothScrollLink({ href, className, children }: { href: `#${string}`; className?: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      className={className}
      onClick={(event) => {
        const target = document.getElementById(href.slice(1));
        if (!target) return;
        event.preventDefault();
        const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        target.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
        history.replaceState(null, "", href);
        target.focus({ preventScroll: true });
      }}
    >
      {children}
    </a>
  );
}
