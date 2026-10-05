"use client";
import { useCallback, useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";

const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * Menu button plus a slide-in navigation drawer for screens below `lg`, built on the native
 * <dialog> like Modal: showModal() traps focus, Esc closes it and the page behind is inert
 * (globals.css stops it scrolling). Closes after following a link, on a route change, on a
 * backdrop click, and when the viewport grows to the desktop sidebar layout.
 */
export function MobileNavDrawer({ brand, children }: { brand: React.ReactNode; children: React.ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  const pathname = usePathname();

  const close = useCallback((animate = true) => {
    const dialog = ref.current;
    if (!dialog?.open || dialog.dataset.closing !== undefined) return;
    if (!animate || reducedMotion()) { dialog.close(); return; }
    dialog.dataset.closing = "";
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      delete dialog.dataset.closing;
      dialog.close();
    };
    dialog.addEventListener("animationend", finish, { once: true });
    window.setTimeout(finish, 260); // in case animationend never fires (e.g. a background tab)
  }, []);

  useEffect(() => { close(false); }, [pathname, close]);

  useEffect(() => {
    const dialog = ref.current;
    const desktop = window.matchMedia("(min-width: 1024px)");
    if (!dialog) return;
    const onCancel = (event: Event) => { event.preventDefault(); close(); };
    const onDesktop = () => { if (desktop.matches) close(false); };
    dialog.addEventListener("cancel", onCancel);
    desktop.addEventListener("change", onDesktop);
    return () => {
      dialog.removeEventListener("cancel", onCancel);
      desktop.removeEventListener("change", onDesktop);
    };
  }, [close]);

  return (
    <>
      <button
        type="button"
        onClick={() => ref.current?.showModal()}
        aria-label="Open navigation"
        aria-haspopup="dialog"
        className="grid size-11 place-items-center rounded-full text-white transition-colors hover:bg-white/10"
      >
        <Menu size={22} strokeWidth={1.75} aria-hidden />
      </button>
      <dialog
        ref={ref}
        aria-label="Navigation"
        onClick={(event) => {
          // A click on the dialog box itself is a backdrop click (the panel fills the box).
          if (event.target === event.currentTarget || (event.target as Element).closest("a[href]")) close();
        }}
        className="nav-drawer shell-dark fixed inset-y-0 left-0 m-0 h-dvh max-h-none w-[min(20rem,86vw)] max-w-none overflow-y-auto overscroll-contain border-0 bg-navy p-0 text-white backdrop:bg-navy/50"
      >
        <div className="flex min-h-full flex-col px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-4">
          <div className="flex items-center justify-between gap-3">
            {brand}
            <button type="button" onClick={() => close()} aria-label="Close navigation" className="grid size-11 place-items-center rounded-full text-white/80 transition-colors hover:bg-white/10 hover:text-white">
              <X size={22} strokeWidth={1.75} aria-hidden />
            </button>
          </div>
          {children}
        </div>
      </dialog>
    </>
  );
}
