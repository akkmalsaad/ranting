/** Decorative initials circle for a person's name (the name itself is always shown as text beside it). */
export function InitialsAvatar({ name }: { name: string }) {
  const initials = name.trim().split(/\s+/).slice(0, 2).map((word) => Array.from(word)[0] ?? "").join("").toUpperCase();
  return <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-full bg-muted text-xs font-semibold text-slate-700">{initials || "?"}</span>;
}
