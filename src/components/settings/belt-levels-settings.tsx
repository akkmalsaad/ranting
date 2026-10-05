"use client";
import { useActionState, useId, useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowUp, Archive, ChevronDown, RotateCcw } from "lucide-react";
import { ActionForm, useFormState, type FormAction, type FormState } from "@/components/action-form";
import { TextField } from "@/components/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormDialog, SaveWatcher, useFormDialog } from "@/components/form-dialog";
import { BeltBadge, BeltSwatch } from "@/components/belt-swatch";
import { createBeltLevel, moveBeltLevel, setBeltLevelArchived, updateBeltLevel } from "@/app/clubs/[clubId]/settings/belt-actions";
import { BELT_PRESET_COLORS, beltLevelSchema, describeBelt } from "@/lib/validation";
import { cn } from "@/lib/utils";

type Level = { id: string; name: string; color: string; stripe_color: string | null; archived_at: string | null };
const HEX = /^#[0-9a-fA-F]{6}$/;
const levelNotice = (): Record<string, string> => ({});

/** Settings → Belt levels: the club's own progression (shared by all branches). */
export function BeltLevelsSettings({ clubId, levels }: { clubId: string; levels: Level[] }) {
  const active = levels.filter((l) => !l.archived_at);
  const archived = levels.filter((l) => l.archived_at);
  return (
    <section id="belt-levels" aria-labelledby="belt-levels-title" className="overflow-hidden rounded-2xl border border-border bg-white">
      <div className="flex flex-wrap items-start justify-between gap-4 p-5 sm:p-6">
        <div className="min-w-0">
          <h2 id="belt-levels-title">Belt levels</h2>
          <p className="mt-0.5 max-w-xl text-[0.8125rem] text-slate-500">Your club&apos;s progression, from first to highest. Shared by all branches; students can be assigned one level.</p>
        </div>
        <FormDialog label="Add belt level" title="Add belt level" description="Name the level and choose its belt colour. New levels go at the end of the progression." noticeParams={levelNotice} modalClassName="sm:max-w-xl">
          <BeltLevelForm action={createBeltLevel.bind(null, clubId)} />
        </FormDialog>
      </div>

      {active.length === 0 ? (
        <div className="border-t border-border px-5 py-10 text-center sm:px-6">
          <BeltSwatch color="#ffffff" className="mx-auto !h-[34px] !w-[58px]" />
          <p className="mt-4 text-sm font-semibold">No belt levels yet</p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-slate-600">Add your club&apos;s first level, for example &ldquo;White belt&rdquo; or &ldquo;Level 1&rdquo;.</p>
        </div>
      ) : (
        <ol className="divide-y divide-border border-t border-border">
          {active.map((level, index) => (
            <li key={level.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3.5 transition-colors hover:bg-slate-50/80 sm:px-6">
              <span className="grid size-7 shrink-0 place-items-center rounded-full bg-muted text-xs font-semibold tabular-nums text-slate-600"><span className="sr-only">Level </span>{index + 1}</span>
              <span className="grid h-11 w-16 shrink-0 place-items-center rounded-xl bg-slate-50 ring-1 ring-inset ring-border">
                <BeltSwatch color={level.color} stripe={level.stripe_color} />
              </span>
              <span className="min-w-0 flex-1 break-words font-semibold">
                {level.name}
                <span className="sr-only"> ({describeBelt(level.color, level.stripe_color)})</span>
              </span>
              <div className="flex flex-wrap items-center gap-0.5">
                <RowAction action={moveBeltLevel.bind(null, clubId, level.id, -1)} disabled={index === 0} label={`Move ${level.name} up`}><ArrowUp size={16} aria-hidden /></RowAction>
                <RowAction action={moveBeltLevel.bind(null, clubId, level.id, 1)} disabled={index === active.length - 1} label={`Move ${level.name} down`}><ArrowDown size={16} aria-hidden /></RowAction>
                <FormDialog label="Edit" title="Edit belt level" description="Changes show everywhere this level is used." noticeParams={levelNotice} modalClassName="sm:max-w-xl" trigger={{ icon: "pencil", variant: "ghost", size: "sm", ariaLabel: `Edit ${level.name}` }}>
                  <BeltLevelForm action={updateBeltLevel.bind(null, clubId, level.id)} level={level} />
                </FormDialog>
                <RowAction action={setBeltLevelArchived.bind(null, clubId, level.id, true)} label={`Archive ${level.name}`}><Archive size={16} aria-hidden /></RowAction>
              </div>
            </li>
          ))}
        </ol>
      )}

      {archived.length > 0 && (
        <details className="group border-t border-border text-sm">
          <summary className="flex cursor-pointer list-none items-center gap-2 px-5 py-3.5 font-semibold text-slate-600 hover:text-foreground sm:px-6 [&::-webkit-details-marker]:hidden">
            <ChevronDown size={16} aria-hidden className="shrink-0 transition-transform duration-200 group-open:rotate-180 motion-reduce:transition-none" />
            Archived levels ({archived.length})
          </summary>
          <p className="px-5 text-[0.8125rem] text-slate-500 sm:px-6">Students who already have these levels keep them; they can&apos;t be assigned to anyone else.</p>
          <ul className="mt-2 divide-y divide-border border-t border-border bg-slate-50/60">
            {archived.map((level) => (
              <li key={level.id} className="flex items-center justify-between gap-3 px-5 py-3 sm:px-6">
                <span className="flex min-w-0 items-center gap-3 text-slate-600">
                  <BeltBadge name={level.name} color={level.color} stripe={level.stripe_color} archived />
                </span>
                <RowAction action={setBeltLevelArchived.bind(null, clubId, level.id, false)} label={`Restore ${level.name}`}><RotateCcw size={16} aria-hidden /> <span className="text-sm">Restore</span></RowAction>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}

/** Small icon button that runs one server action and shows its error beside it. */
function RowAction({ action, label, disabled = false, children }: { action: (state: FormState, form: FormData) => Promise<FormState>; label: string; disabled?: boolean; children: React.ReactNode }) {
  const [state, formAction, pending] = useActionState(action, {});
  return (
    <form action={formAction} className="inline-flex items-center gap-2">
      <Button type="submit" variant="ghost" size="sm" disabled={disabled || pending} aria-label={label} title={label} className="min-w-9 px-2.5">{children}</Button>
      {state.error && <span role="alert" className="max-w-56 text-xs text-red-700">{state.error}</span>}
    </form>
  );
}

/**
 * Add/edit form: name, base colour, optional stripe (off by default for new levels) and a live
 * preview. Turning the stripe off and saving removes it; name and base colour are kept.
 */
function BeltLevelForm({ action, level }: { action: FormAction; level?: Level }) {
  const { close } = useFormDialog();
  const [name, setName] = useState(level?.name ?? "");
  const [base, setBase] = useState(level?.color ?? "#ffffff");
  const [hasStripe, setHasStripe] = useState(!!level?.stripe_color);
  const [stripe, setStripe] = useState(level?.stripe_color ?? "#16a34a");
  const baseColor = HEX.test(base) ? base.toLowerCase() : level?.color ?? "#ffffff";
  const stripeColor = HEX.test(stripe) ? stripe.toLowerCase() : level?.stripe_color ?? "#16a34a";

  return (
    <ActionForm action={action} schema={beltLevelSchema} submit={level ? "Save changes" : "Add level"} footer={<Button type="button" variant="ghost" onClick={close}>Cancel</Button>}>
      <SaveWatcher />
      {/* Live preview first, so every change below is seen immediately. */}
      <div aria-live="polite" className="flex flex-col items-center gap-3 rounded-2xl bg-slate-50 px-4 py-6 ring-1 ring-inset ring-border">
        <BeltSwatch color={baseColor} stripe={hasStripe ? stripeColor : null} labelled className="!h-[58px] !w-[100px]" />
        <p className="max-w-full break-words text-center text-base font-semibold">{name.trim() || "Tahap 2"}</p>
        <p className="text-xs font-medium text-slate-500">Preview</p>
      </div>
      <TextField name="name" label="Level name" defaultValue={level?.name} required maxLength={60} placeholder="e.g. Tahap 2, White belt, Black belt – Dan 1" autoComplete="off" onChange={(e) => setName(e.currentTarget.value)} />
      <ColorPicker legend="Base belt colour" name="color" value={base} onChange={setBase} />
      <div>
        <label className="flex w-fit cursor-pointer items-center gap-2.5 text-sm font-semibold">
          <input type="checkbox" name="stripe" value="on" checked={hasStripe} onChange={(e) => setHasStripe(e.currentTarget.checked)} className="size-4 accent-[var(--primary)]" />
          Add stripe
        </label>
        <p className="mt-1 text-xs text-slate-500">Shown as three short bands in the stripe colour near the tip of the belt.</p>
      </div>
      {hasStripe && <ColorPicker legend="Stripe colour" name="stripe_color" value={stripe} onChange={setStripe} />}
    </ActionForm>
  );
}

/** Preset swatches (radio group with arrow keys), native colour picker and the submitted hex field. */
function ColorPicker({ legend, name, value, onChange }: { legend: string; name: string; value: string; onChange: (value: string) => void }) {
  const color = HEX.test(value) ? value.toLowerCase() : "#ffffff";
  const presetRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const checkedIndex = useMemo(() => BELT_PRESET_COLORS.findIndex((p) => p.value === color), [color]);

  function onPresetKey(event: React.KeyboardEvent, index: number) {
    const step = event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 0;
    if (!step) return;
    event.preventDefault();
    const next = (index + step + BELT_PRESET_COLORS.length) % BELT_PRESET_COLORS.length;
    onChange(BELT_PRESET_COLORS[next].value);
    presetRefs.current[next]?.focus();
  }

  return (
    <fieldset>
      <legend className="text-sm font-semibold">{legend}</legend>
      <div role="radiogroup" aria-label={`${legend}: presets`} className="mt-2 flex flex-wrap gap-2">
        {BELT_PRESET_COLORS.map((preset, index) => (
          <button
            key={preset.value}
            ref={(element) => { presetRefs.current[index] = element; }}
            type="button"
            role="radio"
            aria-checked={index === checkedIndex}
            aria-label={preset.label}
            title={preset.label}
            tabIndex={index === (checkedIndex === -1 ? 0 : checkedIndex) ? 0 : -1}
            onClick={() => onChange(preset.value)}
            onKeyDown={(event) => onPresetKey(event, index)}
            className={cn("size-9 rounded-full ring-1 ring-inset ring-slate-900/25 transition-shadow focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary", index === checkedIndex && "shadow-[0_0_0_3px_white,0_0_0_5px_var(--primary)]")}
            style={{ backgroundColor: preset.value }}
          />
        ))}
      </div>
      <div className="mt-4 flex flex-wrap items-start gap-3">
        <label className="text-sm">Custom colour
          <input type="color" value={color} onChange={(e) => onChange(e.currentTarget.value)} aria-label={`${legend}: custom colour picker`} className="mt-1.5 block h-11 w-14 cursor-pointer rounded-xl border border-border bg-white p-1" />
        </label>
        <HexField name={name} label={`${legend}: hex code`} value={value} onChange={onChange} />
      </div>
    </fieldset>
  );
}

/** A submitted colour field: validated hex (#rrggbb), with the server's error shown beneath. */
function HexField({ name, label, value, onChange }: { name: string; label: string; value: string; onChange: (value: string) => void }) {
  const id = useId();
  const error = useFormState().fieldErrors?.[name]?.[0] ?? (HEX.test(value) ? undefined : "Enter a colour like #1a2b3c.");
  return (
    <div className="min-w-0 flex-1">
      <label htmlFor={id} className="text-sm"><span className="sr-only">{label.replace(": hex code", "")} </span>Hex code</label>
      <Input id={id} name={name} value={value} onChange={(e) => onChange(e.currentTarget.value.trim())} maxLength={7} pattern="#[0-9a-fA-F]{6}" required aria-invalid={!!error} aria-describedby={error ? `${id}-error` : undefined} className="mt-1.5 max-w-40 font-mono" />
      {error && <p id={`${id}-error`} className="mt-1.5 text-sm font-medium text-red-700">{error}</p>}
    </div>
  );
}
