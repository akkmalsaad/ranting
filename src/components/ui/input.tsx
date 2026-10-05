import * as React from "react";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";

/** Text input: 44px, the shared border/radius and focus ring. 16px text on phones stops iOS zooming. */
export function Input({ className, ...props }: React.ComponentProps<"input">) {
  return <input className={cn("h-11 w-full rounded-xl border border-border bg-white px-3.5 text-base text-foreground outline-none transition-[border-color,box-shadow] duration-150 placeholder:text-slate-400 hover:border-[#c9d5da] focus-visible:border-primary focus-visible:ring-4 focus-visible:ring-primary/15 disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-70 sm:text-[0.9375rem]", className)} {...props} />;
}

/** Search field: Input with a leading search icon. Pair it with a visible or sr-only label. */
export function SearchInput({ className, ...props }: Omit<React.ComponentProps<"input">, "type">) {
  return (
    <div className={cn("relative min-w-0", className)}>
      <Search size={16} aria-hidden className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
      <Input type="search" className="pl-10 [&::-webkit-search-cancel-button]:cursor-pointer" {...props} />
    </div>
  );
}
