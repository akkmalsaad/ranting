"use client";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { ChevronDown, Link2, Plus, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AddStudentDialog } from "@/components/students/add-student-dialog";
import { ShareRegistrationDialog } from "@/components/registrations/share-registration-dialog";
import type { FormAction } from "@/components/action-form";
import type { StudentBranchOption } from "@/components/students/student-form";
import type { BeltLevelOption } from "@/components/students/belt-level-field";
import { cn } from "@/lib/utils";

type Props = { clubId: string; action: FormAction; clubName: string; today: string; branches: StudentBranchOption[]; initialBranchId?: string; beltLevels?: BeltLevelOption[]; settingsHref?: string; align?: "left" | "right" };

/**
 * "Add student" menu: Add manually (the existing Add student modal, unchanged) or
 * Send registration link (parents register; the club approves each registration).
 */
export function AddStudentMenu({ clubId, align = "right", ...dialog }: Props) {
  const menuId = useId();
  const [menuOpen, setMenuOpen] = useState(false);
  const [open, setOpen] = useState<"manual" | "share" | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    if (!menuOpen) return;
    itemRefs.current[0]?.focus();
    const onPointerDown = (event: PointerEvent) => { if (!rootRef.current?.contains(event.target as Node)) setMenuOpen(false); };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [menuOpen]);

  const closeDialog = useCallback(() => {
    setOpen(null);
    requestAnimationFrame(() => buttonRef.current?.focus());
  }, []);
  const onManualChange = useCallback((isOpen: boolean) => { if (!isOpen) closeDialog(); }, [closeDialog]);

  function choose(which: "manual" | "share") {
    setMenuOpen(false);
    setOpen(which);
  }

  function onMenuKeyDown(event: React.KeyboardEvent) {
    const items = itemRefs.current.filter((item): item is HTMLButtonElement => !!item);
    const index = items.indexOf(document.activeElement as HTMLButtonElement);
    const focus = (i: number) => { event.preventDefault(); items[(i + items.length) % items.length]?.focus(); };
    if (event.key === "ArrowDown") focus(index + 1);
    else if (event.key === "ArrowUp") focus(index - 1);
    else if (event.key === "Home") focus(0);
    else if (event.key === "End") focus(items.length - 1);
    else if (event.key === "Escape") { event.preventDefault(); setMenuOpen(false); buttonRef.current?.focus(); }
    else if (event.key === "Tab") setMenuOpen(false);
  }

  const items = [
    { key: "manual" as const, icon: UserPlus, title: "Add manually", body: "Enter the student's details yourself." },
    { key: "share" as const, icon: Link2, title: "Send registration link", body: "Parents register; you approve each one." },
  ];

  return (
    <div ref={rootRef} className="relative">
      <Button
        ref={buttonRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        aria-controls={menuOpen ? menuId : undefined}
        onClick={() => setMenuOpen((isOpen) => !isOpen)}
        onKeyDown={(event) => { if (event.key === "ArrowDown" && !menuOpen) { event.preventDefault(); setMenuOpen(true); } }}
      >
        <Plus size={16} aria-hidden /> Add student <ChevronDown size={16} aria-hidden className={cn("transition-transform", menuOpen && "rotate-180")} />
      </Button>
      {menuOpen && (
        <div
          id={menuId}
          role="menu"
          aria-label="Add student"
          onKeyDown={onMenuKeyDown}
          className={cn("popover-in absolute top-[calc(100%+0.375rem)] z-30 w-72 max-w-[calc(100vw-2rem)] rounded-xl border border-border bg-white p-1.5 shadow-[0_16px_40px_-12px_#071e3033,0_2px_6px_#071e3010]", align === "right" ? "right-0" : "left-0")}
        >
          {items.map(({ key, icon: Icon, title, body }, i) => (
            <button
              key={key}
              ref={(element) => { itemRefs.current[i] = element; }}
              type="button"
              role="menuitem"
              tabIndex={-1}
              onClick={() => choose(key)}
              className="flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
            >
              <Icon size={18} aria-hidden className="mt-0.5 shrink-0 text-primary" />
              <span><span className="block text-sm font-semibold">{title}</span><span className="block text-xs text-slate-500">{body}</span></span>
            </button>
          ))}
        </div>
      )}
      <AddStudentDialog {...dialog} hideTrigger open={open === "manual"} onOpenChange={onManualChange} />
      {open === "share" && (
        <ShareRegistrationDialog clubId={clubId} clubName={dialog.clubName} branches={dialog.branches.filter((b) => !b.archived).map((b) => ({ id: b.id, name: b.name }))} initialBranchId={dialog.initialBranchId} onClose={closeDialog} />
      )}
    </div>
  );
}
