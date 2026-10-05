import Image from "next/image";
import { assets } from "@/lib/assets";

/** Minimal branded layout for public registration pages (no club data beyond what's passed in). */
export function PublicShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-background px-4 py-10 sm:py-14">
      <div className="mx-auto max-w-2xl">
        <Image src={assets.banner} alt="Ranting" className="mb-8 h-auto w-32" priority />
        {children}
        <p className="mt-10 text-center text-xs text-slate-500">Powered by Ranting · Martial arts club management</p>
      </div>
    </main>
  );
}
