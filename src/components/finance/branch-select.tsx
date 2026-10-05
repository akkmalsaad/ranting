"use client";
import { Fragment, useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { Award, CalendarDays, Check, ChevronDown, MapPin, Tag } from "lucide-react";
import { cn } from "@/lib/utils";
import { BeltSwatch } from "@/components/belt-swatch";

/**
 * `color` (optional) shows a belt swatch for that option instead of the field icon.
 * `group` (optional) shows a heading before the first option of each consecutive group
 * (an <optgroup> before hydration); the trigger then reads "Group · Label".
 */
export type BranchOption = { value: string; label: string; color?: string; stripe?: string | null; group?: string };

// Shared trigger look for the pre-hydration native select and the interactive combobox.
export const triggerClass =
  "flex h-11 w-full min-w-0 items-center gap-2.5 rounded-xl border border-border bg-white pl-3 pr-10 text-left text-sm font-medium text-foreground shadow-[0_1px_2px_#071e300d] transition-[border-color,box-shadow,background-color] duration-150 hover:border-[#c9d5da] hover:bg-[#fbfcfc] focus-visible:border-primary focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/15";

const subscribe = () => () => {};
const display = (option: BranchOption) => (option.group ? `${option.group} · ${option.label}` : option.label);
/** Consecutive options sharing a group (ungrouped options form their own runs). */
function groupOptions(options: BranchOption[]) {
  const runs: { group?: string; items: BranchOption[] }[] = [];
  for (const option of options) {
    const run = runs[runs.length - 1];
    if (run && run.group === option.group) run.items.push(option);
    else runs.push({ group: option.group, items: [option] });
  }
  return runs;
}

/**
 * Branch picker styled as a modern select. It submits through a hidden `name` input, so the
 * surrounding GET form (and its Apply button) work exactly as with a native <select>.
 * Before hydration it renders a native select with the same look, so the form still works
 * without JavaScript. Interaction follows the WAI-ARIA "select-only combobox" pattern.
 */
// Icons are chosen by name: a Server Component can't pass a component (function) as a prop.
const icons = { branch: MapPin, category: Tag, belt: Award, calendar: CalendarDays };

/** `icon` defaults to the branch map pin; other filters (e.g. category) pick theirs by name. */
/** `onValueChange` (client callers only) runs when the user picks an option, e.g. to apply a filter immediately. */
export function BranchSelect({ name, label, options, defaultValue, icon: iconName = "branch", onValueChange }: { name: string; label: string; options: BranchOption[]; defaultValue: string; icon?: keyof typeof icons; onValueChange?: (value: string) => void }) {
  const Icon = icons[iconName];
  const id = useId();
  const labelId = `${id}-label`;
  const listId = `${id}-listbox`;
  const optionId = (index: number) => `${id}-option-${index}`;
  const hydrated = useSyncExternalStore(subscribe, () => true, () => false);

  const [value, setValue] = useState(defaultValue);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const typeahead = useRef({ text: "", timer: 0 });

  const selectedIndex = Math.max(0, options.findIndex((o) => o.value === value));
  const selected = options[selectedIndex];
  const last = options.length - 1;

  // Close when clicking or tapping anywhere outside the control.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => { if (!rootRef.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  // Keep the highlighted option visible while moving through a long list.
  useEffect(() => {
    if (open) document.getElementById(`${id}-option-${active}`)?.scrollIntoView({ block: "nearest" });
  }, [open, active, id]);

  function show(index: number) { setActive(index); setOpen(true); }
  function choose(index: number) {
    const next = options[index].value;
    setValue(next);
    setOpen(false);
    if (next !== value) onValueChange?.(next);
  }

  /** Type-to-find: jumps to the next option starting with the typed characters. */
  function findByText(char: string, from: number) {
    const buffer = typeahead.current;
    window.clearTimeout(buffer.timer);
    buffer.text += char.toLowerCase();
    buffer.timer = window.setTimeout(() => { buffer.text = ""; }, 500);
    const ordered = [...options.slice(from + 1), ...options.slice(0, from + 1)];
    const match = ordered.find((o) => o.label.toLowerCase().startsWith(buffer.text)) ?? ordered.find((o) => o.label.toLowerCase().startsWith(char.toLowerCase()));
    return match ? options.indexOf(match) : -1;
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLButtonElement>) {
    const printable = event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey && event.key !== " ";
    if (!open) {
      if (["ArrowDown", "ArrowUp", "Enter", " "].includes(event.key)) { event.preventDefault(); show(selectedIndex); }
      else if (event.key === "Home") { event.preventDefault(); show(0); }
      else if (event.key === "End") { event.preventDefault(); show(last); }
      else if (printable) { const match = findByText(event.key, selectedIndex); show(match === -1 ? selectedIndex : match); }
      return;
    }
    switch (event.key) {
      case "ArrowDown": event.preventDefault(); setActive((i) => Math.min(i + 1, last)); break;
      case "ArrowUp": event.preventDefault(); if (event.altKey) choose(active); else setActive((i) => Math.max(i - 1, 0)); break;
      case "Home": event.preventDefault(); setActive(0); break;
      case "End": event.preventDefault(); setActive(last); break;
      case "PageDown": event.preventDefault(); setActive((i) => Math.min(i + 10, last)); break;
      case "PageUp": event.preventDefault(); setActive((i) => Math.max(i - 10, 0)); break;
      case "Enter": case " ": event.preventDefault(); choose(active); break;
      case "Escape": event.preventDefault(); setOpen(false); break;
      case "Tab": choose(active); break; // select and let focus move on
      default: if (printable) { const match = findByText(event.key, active); if (match !== -1) setActive(match); }
    }
  }

  const icon = <Icon size={16} aria-hidden className="pointer-events-none shrink-0 text-primary" />;
  const chevron = (turned: boolean) => <ChevronDown size={16} aria-hidden className={cn("pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 transition-transform duration-150", turned && "rotate-180 text-primary")} />;

  return (
    <div ref={rootRef} className="min-w-0">
      <label id={labelId} htmlFor={id} className="mb-2">{label}</label>
      <div className="relative">
        {hydrated ? (
          <>
            <input type="hidden" name={name} value={value} />
            <button
              id={id}
              type="button"
              role="combobox"
              aria-haspopup="listbox"
              aria-expanded={open}
              aria-controls={listId}
              aria-labelledby={labelId}
              aria-activedescendant={open ? optionId(active) : undefined}
              onClick={() => (open ? setOpen(false) : show(selectedIndex))}
              onKeyDown={onKeyDown}
              onBlur={() => setOpen(false)}
              className={cn(triggerClass, open && "border-primary ring-4 ring-primary/15")}
            >
              {selected.color ? <BeltSwatch color={selected.color} stripe={selected.stripe} labelled /> : icon}
              <span className="min-w-0 flex-1 truncate" title={display(selected)}>{display(selected)}</span>
            </button>
            {chevron(open)}
            <ul
              id={listId}
              role="listbox"
              aria-labelledby={labelId}
              tabIndex={-1}
              hidden={!open}
              onMouseDown={(event) => event.preventDefault()} // keep focus on the combobox (incl. scrollbar drags)
              className="popover-in absolute left-0 top-[calc(100%+0.375rem)] z-30 max-h-72 w-full min-w-56 overflow-y-auto overscroll-contain rounded-xl border border-border bg-white p-1.5 shadow-[0_16px_40px_-12px_#071e3033,0_2px_6px_#071e3010]"
            >
              {options.map((option, index) => {
                const isSelected = option.value === value;
                const heading = option.group && option.group !== options[index - 1]?.group;
                return (
                  <Fragment key={option.value || "whole-club"}>
                  {heading && <li role="presentation" aria-hidden className="px-3 pb-1 pt-2.5 text-xs font-semibold uppercase tracking-wider text-slate-500">{option.group}</li>}
                  <li
                    id={optionId(index)}
                    role="option"
                    aria-selected={isSelected}
                    aria-label={option.group ? display(option) : undefined}
                    title={option.label}
                    onMouseMove={() => { if (active !== index) setActive(index); }}
                    onClick={() => choose(index)}
                    className={cn(
                      "flex cursor-pointer select-none items-center gap-2 rounded-lg px-3 py-2.5 text-sm text-foreground",
                      isSelected && "bg-primary/[0.07] font-semibold text-primary",
                      index === active && (isSelected ? "bg-primary/[0.12]" : "bg-muted"),
                    )}
                  >
                    {option.color && <BeltSwatch color={option.color} stripe={option.stripe} labelled />}
                    <span className="min-w-0 flex-1 truncate">{option.label}</span>
                    <Check size={16} aria-hidden className={cn("shrink-0 text-primary", !isSelected && "invisible")} />
                  </li>
                  </Fragment>
                );
              })}
            </ul>
          </>
        ) : (
          <>
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2">{icon}</span>
            {/* Global select styles are unlayered, so the overrides below use `!`. */}
            <select id={id} name={name} defaultValue={defaultValue} className={cn(triggerClass, "appearance-none !rounded-xl !py-0 !pl-9 !pr-10 !text-sm focus-visible:!outline-none")}>
              {groupOptions(options).map(({ group, items }, i) => {
                const rendered = items.map((option) => <option key={option.value || "whole-club"} value={option.value}>{option.label}</option>);
                return group ? <optgroup key={`${group}-${i}`} label={group}>{rendered}</optgroup> : <Fragment key={`ungrouped-${i}`}>{rendered}</Fragment>;
              })}
            </select>
            {chevron(false)}
          </>
        )}
      </div>
    </div>
  );
}
