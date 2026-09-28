import type { LucideIcon } from "lucide-react";
import { PageHeader } from "@/components/page-header";

/** Honest placeholder for planned modules: nothing here saves or pretends to work. */
export function ComingSoon({ title, icon: Icon, body }: { title: string; icon: LucideIcon; body: string }) {
  return (
    <>
      <PageHeader title={title} />
      <section className="panel flex flex-col items-start gap-4">
        <span className="grid size-12 place-items-center rounded-2xl bg-muted text-slate-600"><Icon aria-hidden /></span>
        <h2>Not available yet</h2>
        <p className="max-w-lg text-sm leading-6 text-slate-600">{body}</p>
      </section>
    </>
  );
}
