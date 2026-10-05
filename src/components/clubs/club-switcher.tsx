"use client";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

export function ClubSwitcher({ clubs, currentId, tone = "light" }: { clubs: { id: string; name: string }[]; currentId: string; tone?: "light" | "dark" }) {
  const router = useRouter();
  return (
    <label className={cn("block text-xs font-semibold uppercase tracking-wider", tone === "dark" ? "text-white/60" : "text-slate-500")}>
      Switch club
      <select value={currentId} onChange={(e) => router.push(`/clubs/${e.target.value}`)} className="mt-1.5 py-2 text-sm font-medium normal-case tracking-normal text-foreground">
        {clubs.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>
    </label>
  );
}
