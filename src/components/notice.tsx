import { CheckCircle2 } from "lucide-react";

/** Confirmation after a redirecting action. Only fixed messages keyed by `code` are shown. */
export function Notice({ code, messages }: { code: unknown; messages: Record<string, string> }) {
  const message = typeof code === "string" ? messages[code] : undefined;
  if (!message) return null;
  return <p role="status" className="mb-6 flex items-center gap-2 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-900"><CheckCircle2 size={18} aria-hidden /> {message}</p>;
}
