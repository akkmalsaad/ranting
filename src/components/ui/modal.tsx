"use client";
import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Modal built on the native <dialog>: showModal() traps focus and makes the page behind it inert
 * (globals.css also stops the page scrolling while a modal is open).
 * Rendered with `open` so the content (and its Server Action form) works before hydration, then
 * upgraded to a true modal. Dismissal:
 * - neither prop: can't be closed with Esc (required steps);
 * - `dismissHref`: Esc/closing navigates there;
 * - `onDismiss`: in-page modal; Esc, the X button or closing calls it (the caller unmounts the modal).
 * Bottom sheet on small screens; from sm a centred dialog, or with `placement="side"` a full-height
 * panel on the right (details views). Enter motion is in globals.css (`.modal-dialog`).
 * `bodyScroll`: the dialog itself doesn't scroll; its children lay out as a column in which the
 * caller's body region scrolls (so a header and an actions footer stay visible).
 *
 * The <dialog> is rendered next to its trigger, so it would inherit that spot's text styles (e.g. a
 * right-aligned, no-wrap table cell or a centred empty state). It resets them so dialog content
 * always starts left-aligned at the normal text size.
 */
export function Modal({ labelledBy, dismissHref, onDismiss, children, className, placement = "center", bodyScroll = false }: { labelledBy: string; dismissHref?: string; onDismiss?: () => void; children: React.ReactNode; className?: string; placement?: "center" | "side"; bodyScroll?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  const router = useRouter();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (!dialog.matches(":modal")) {
      dialog.close();
      dialog.showModal();
    }
    const onCancel = (event: Event) => {
      if (onDismiss) { event.preventDefault(); onDismiss(); }
      else if (!dismissHref) event.preventDefault();
    };
    const onClose = () => {
      if (dialog.open) return; // the close() above, fired after re-opening as modal
      if (onDismiss) onDismiss();
      else if (dismissHref) router.push(dismissHref);
      else dialog.showModal(); // browsers may force-close on repeated Esc; keep it open
    };
    dialog.addEventListener("cancel", onCancel);
    dialog.addEventListener("close", onClose);
    return () => {
      dialog.removeEventListener("cancel", onCancel);
      dialog.removeEventListener("close", onClose);
    };
  }, [dismissHref, onDismiss, router]);

  return (
    <dialog
      ref={ref}
      open
      aria-labelledby={labelledBy}
      aria-modal="true"
      data-placement={placement}
      className={cn(
        // Phones: a bottom sheet using nearly the full height. sm and up: a centred dialog, or a
        // right-hand panel the full height of the window.
        "modal-dialog fixed inset-x-0 bottom-0 top-auto z-50 m-0 max-h-[94dvh] w-full max-w-none overflow-y-auto overscroll-contain rounded-t-[1.5rem] border-0 bg-white p-0 text-left text-base font-normal whitespace-normal text-foreground shadow-[0_-12px_40px_-12px_#071e3040] backdrop:bg-navy/50",
        bodyScroll && "flex flex-col overflow-hidden",
        placement === "side"
          ? "sm:inset-y-0 sm:left-auto sm:right-0 sm:h-dvh sm:max-h-dvh sm:w-[min(34rem,calc(100%-3rem))] sm:rounded-none sm:rounded-l-2xl sm:shadow-[-24px_0_64px_-16px_#071e3059]"
          : "sm:inset-0 sm:m-auto sm:h-fit sm:max-h-[90dvh] sm:w-[calc(100%-2rem)] sm:max-w-xl sm:rounded-2xl sm:shadow-[0_24px_64px_-16px_#071e3059]",
        className,
      )}
    >
      <span aria-hidden className="mx-auto mt-2.5 block h-1 w-10 shrink-0 rounded-full bg-slate-200 sm:hidden" />
      {onDismiss && (
        <button type="button" onClick={onDismiss} aria-label="Close" className="absolute right-3 top-3 grid size-10 place-items-center rounded-xl text-slate-500 transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary sm:right-4 sm:top-4">
          <X size={20} aria-hidden />
        </button>
      )}
      {bodyScroll
        ? <div className="flex min-h-0 flex-1 flex-col">{children}</div>
        : <div className="p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:p-7">{children}</div>}
    </dialog>
  );
}
