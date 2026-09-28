"use client";
import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

/**
 * Modal built on the native <dialog>: showModal() traps focus and makes the page behind it inert.
 * Rendered with `open` so the content (and its Server Action form) works before hydration, then
 * upgraded to a true modal. Without `dismissHref` it can't be closed with Esc; with it, Esc or
 * closing navigates there. Full-screen sheet on small screens.
 */
export function Modal({ labelledBy, dismissHref, children, className }: { labelledBy: string; dismissHref?: string; children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDialogElement>(null);
  const router = useRouter();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (!dialog.matches(":modal")) {
      dialog.close();
      dialog.showModal();
    }
    const onCancel = (event: Event) => { if (!dismissHref) event.preventDefault(); };
    const onClose = () => {
      if (dialog.open) return; // the close() above, fired after re-opening as modal
      if (dismissHref) router.push(dismissHref);
      else dialog.showModal(); // browsers may force-close on repeated Esc; keep it open
    };
    dialog.addEventListener("cancel", onCancel);
    dialog.addEventListener("close", onClose);
    return () => {
      dialog.removeEventListener("cancel", onCancel);
      dialog.removeEventListener("close", onClose);
    };
  }, [dismissHref, router]);

  return (
    <dialog
      ref={ref}
      open
      aria-labelledby={labelledBy}
      aria-modal="true"
      className={cn(
        "fixed inset-0 z-50 m-0 h-dvh max-h-none w-screen max-w-none overflow-y-auto border-0 bg-white p-0 text-foreground backdrop:bg-[#071e30]/60",
        "sm:m-auto sm:h-fit sm:max-h-[90dvh] sm:w-[calc(100%-2rem)] sm:max-w-xl sm:rounded-3xl sm:shadow-2xl",
        className,
      )}
    >
      <div className="p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:p-8">{children}</div>
    </dialog>
  );
}
