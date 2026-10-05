"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { SearchInput } from "@/components/ui/input";
import { feesHref } from "@/lib/fees/values";

/**
 * Student search for the Fees list: applies as you type (300 ms after the last keystroke) or at
 * once on Enter, keeping `q` in the URL (links, refresh and Back keep the search). While typing it
 * replaces the history entry rather than adding one per pause. Without JavaScript it's a plain GET
 * form, submitted with Enter. Other filters are kept; the page resets to 1.
 */
export function FeeSearch({ base, query, value }: { base: string; query: Record<string, string>; value: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [text, setText] = useState(value);
  const [shown, setShown] = useState(value);
  // Follow the URL when it changes elsewhere (e.g. "Clear filters").
  if (shown !== value) { setShown(value); setText(value); }
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  const apply = (raw: string) => {
    clearTimeout(timer.current);
    const next = raw.trim();
    if (next === value) return;
    startTransition(() => router.replace(feesHref(base, query, { q: next || undefined, page: undefined }), { scroll: false }));
  };

  return (
    <form role="search" action={base} onSubmit={(e) => { e.preventDefault(); apply(text); }} className="relative mb-5 max-w-sm" aria-busy={pending}>
      {Object.entries(query).filter(([k]) => k !== "q" && k !== "page").map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      <label className="sr-only" htmlFor="fee-search">Search students</label>
      <SearchInput
        id="fee-search"
        name="q"
        value={text}
        onChange={(e) => { const next = e.target.value; setText(next); clearTimeout(timer.current); timer.current = setTimeout(() => apply(next), 300); }}
        maxLength={80}
        placeholder="Search by student name"
        autoComplete="off"
      />
      {pending && <span role="status" className="absolute -bottom-5 left-0 inline-flex items-center gap-1 text-xs font-medium text-primary"><Loader2 size={12} aria-hidden className="animate-spin motion-reduce:animate-none" /> Searching…</span>}
    </form>
  );
}
