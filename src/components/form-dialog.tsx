"use client";
import { createContext, useCallback, useContext, useEffect, useId, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Pencil, Plus } from "lucide-react";
import { useFormState, type FormState } from "@/components/action-form";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";

type NoticeParams = (count: number) => Record<string, string>;
type Controls = { close: () => void; onSaved: (count: number, params?: Record<string, string>) => void };
const FormDialogContext = createContext<Controls>({ close: () => {}, onSaved: () => {} });
/** For forms inside a FormDialog: `close` (Cancel) and `onSaved` (used by SaveWatcher). */
export const useFormDialog = () => useContext(FormDialogContext);
const defaultNotice: NoticeParams = () => ({ notice: "created" });

/**
 * "Add …" button that opens a form in the shared Modal on top of the current page (used by
 * Add student and Add branch). The form is mounted per opening, so it always starts fresh.
 * After a successful save (the action returns `saved`), the modal closes, focus returns to the
 * button, and the page's existing notice is shown via its query params. The list itself is
 * refreshed by the action's revalidatePath.
 */
export function FormDialog({ label, title, description, noticeParams = defaultNotice, trigger, modalClassName = "sm:max-w-3xl", open: openProp, onOpenChange, hideTrigger = false, scrollBody = false, children }: {
  label: string;
  title: string;
  description: React.ReactNode;
  noticeParams?: NoticeParams;
  /** Trigger button look; defaults to the primary "+ Add …" button. */
  trigger?: { icon?: "plus" | "pencil" | "none"; variant?: "default" | "outline" | "ghost"; size?: "default" | "sm"; className?: string; ariaLabel?: string };
  /** Modal width override (default: sm:max-w-3xl). */
  modalClassName?: string;
  /** Controlled mode (e.g. opened from a menu): the caller owns `open` and restores focus on close. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  hideTrigger?: boolean;
  /**
   * Long forms: the header stays at the top and the actions at the bottom while only the fields
   * scroll. The form inside must use `<ActionForm layout="dialog">`.
   */
  scrollBody?: boolean;
  children: React.ReactNode;
}) {
  const titleId = useId();
  const [innerOpen, setInnerOpen] = useState(false);
  const open = openProp ?? innerOpen;
  const setOpen = useCallback((next: boolean) => {
    if (openProp === undefined) setInnerOpen(next);
    onOpenChange?.(next);
  }, [openProp, onOpenChange]);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const router = useRouter();
  const pathname = usePathname();

  const close = useCallback(() => {
    setOpen(false);
    requestAnimationFrame(() => triggerRef.current?.focus());
  }, [setOpen]);

  const onSaved = useCallback((count: number, extra?: Record<string, string>) => {
    close();
    const params = new URLSearchParams(window.location.search);
    params.delete("notice");
    params.delete("count");
    for (const [key, value] of Object.entries({ ...noticeParams(count), ...extra })) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    router.replace(`${pathname}?${params}`, { scroll: false });
  }, [close, noticeParams, pathname, router]);

  return (
    <>
      {!hideTrigger && <Button ref={triggerRef} type="button" variant={trigger?.variant ?? "default"} size={trigger?.size} className={trigger?.className} aria-label={trigger?.ariaLabel} onClick={() => setOpen(true)} aria-haspopup="dialog">
        {trigger?.icon === "pencil" ? <Pencil size={16} aria-hidden /> : trigger?.icon === "none" ? null : <Plus size={16} aria-hidden />} {label}
      </Button>}
      {open && (
        <Modal labelledBy={titleId} onDismiss={close} className={modalClassName} bodyScroll={scrollBody}>
          {scrollBody
            ? <div className="shrink-0 px-5 pt-5 sm:px-8 sm:pt-7"><ModalHeader id={titleId} title={title} description={description} /></div>
            : <ModalHeader id={titleId} title={title} description={description} />}
          <FormDialogContext value={{ close, onSaved }}>{children}</FormDialogContext>
        </Modal>
      )}
    </>
  );
}

/** Place inside an ActionForm within a FormDialog: closes it once per successful save. */
export function SaveWatcher() {
  const { onSaved } = useFormDialog();
  const state = useFormState();
  const handled = useRef<FormState | null>(null);
  useEffect(() => {
    if (!state.saved || handled.current === state) return;
    handled.current = state;
    onSaved(state.saved.count, state.saved.params);
  }, [state, onSaved]);
  return null;
}

/** Modal title and supporting text, shared by every dialog so headers line up. */
export function ModalHeader({ id, title, description, children }: { id: string; title: React.ReactNode; description?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="mb-6 pr-12">
      {children}
      <h2 id={id} className="break-words text-[1.375rem]! leading-tight tracking-[-0.025em]! sm:text-2xl!">{title}</h2>
      {description && <p className="mt-1.5 text-sm leading-6 text-slate-600">{description}</p>}
    </div>
  );
}

/**
 * Stage indicator for multi-step dialogs (Add fee, Generate monthly fees). Purely visual: each
 * flow keeps its own step state; the current step is also announced as text.
 */
export function ModalSteps({ steps, current }: { steps: string[]; current: number }) {
  return (
    <ol aria-label="Steps" className="mb-6 flex flex-wrap items-center gap-x-2 gap-y-2 text-[0.8125rem]">
      {steps.map((label, index) => {
        const state = index < current ? "done" : index === current ? "current" : "upcoming";
        return (
          <li key={label} aria-current={state === "current" ? "step" : undefined} className="flex items-center gap-2">
            {index > 0 && <span aria-hidden className={`h-px w-6 sm:w-10 ${state === "upcoming" ? "bg-border" : "bg-navy/40"}`} />}
            <span className={`grid size-6 place-items-center rounded-full text-xs font-semibold tabular-nums transition-colors duration-200 ${state === "upcoming" ? "bg-muted text-slate-500" : "bg-navy text-white"}`}>{index + 1}</span>
            <span className={state === "current" ? "font-semibold text-foreground" : "text-slate-500"}>{label}<span className="sr-only">{state === "done" ? " (completed)" : state === "current" ? " (current step)" : ""}</span></span>
          </li>
        );
      })}
    </ol>
  );
}
