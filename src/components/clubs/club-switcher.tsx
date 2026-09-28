"use client";
import { useRouter } from "next/navigation";

export function ClubSwitcher({ clubs, currentId }: { clubs: { id: string; name: string }[]; currentId: string }) {
  const router = useRouter();
  return (
    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500">
      Switch club
      <select value={currentId} onChange={(e) => router.push(`/clubs/${e.target.value}`)} className="mt-1.5 py-2 text-sm font-medium normal-case tracking-normal text-foreground">
        {clubs.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>
    </label>
  );
}
