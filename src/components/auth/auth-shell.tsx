import Image from "next/image";
import { assets } from "@/lib/assets";

/** Two-column branded layout shared by sign-in, sign-up and password screens. */
export function AuthShell({ title, description, children, footer }: { title: string; description?: React.ReactNode; children?: React.ReactNode; footer?: React.ReactNode }) {
  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      <section className="flex flex-col justify-between bg-[#071e30] p-8 text-white lg:p-16">
        <span className="text-sm font-semibold uppercase tracking-[.25em] text-emerald-300">Built for your club</span>
        <div className="my-20 max-w-lg">
          <p className="text-4xl font-semibold leading-tight tracking-tight lg:text-6xl">Less admin.<br />More time on<br />the mat.</p>
          <p className="mt-6 max-w-sm leading-7 text-slate-300">Your branches, your students, your community. Bring it all together in one workspace.</p>
        </div>
        <p className="text-sm text-slate-300">Independent clubs. One connected platform.</p>
      </section>
      <section className="flex items-center justify-center p-6 py-14">
        <div className="w-full max-w-sm">
          <Image src={assets.banner} alt="Ranting" className="mb-10 h-auto w-44" priority />
          <h1>{title}</h1>
          {description && <p className="mb-8 mt-3 text-slate-600">{description}</p>}
          {children}
          {footer && <div className="mt-8 space-y-3 text-sm text-slate-600">{footer}</div>}
        </div>
      </section>
    </main>
  );
}
