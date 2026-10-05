import { CheckCircle2 } from "lucide-react";

/** Confirmation after a redirecting action. Only fixed messages keyed by `code` are shown. */
export function Notice({ code, messages }: { code: unknown; messages: Record<string, string> }) {
  const message = typeof code === "string" ? messages[code] : undefined;
  if (!message) return null;
  return <SuccessNote className="mb-6">{message}</SuccessNote>;
}

/** Success message styling shared by notices and in-page confirmations. */
export function SuccessNote({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <p role="status" className={`flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl border border-emerald-200/70 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 ${className}`}><CheckCircle2 size={18} aria-hidden className="shrink-0" /> {children}</p>;
}
