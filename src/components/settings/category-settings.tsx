"use client";
import { useActionState, useEffect, useId, useMemo, useState, useTransition } from "react";
import { Archive, Pencil, Plus, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { FormDialog, useFormDialog } from "@/components/form-dialog";
import type { FormState } from "@/components/action-form";
import type { CategoryOption, ClubCategories, TransactionKind } from "@/lib/finance/values";
import { addCategory, renameCategory, setCategoryArchived } from "@/app/clubs/[clubId]/settings/preference-actions";

const KINDS: { kind: TransactionKind; title: string }[] = [{ kind: "income", title: "Income categories" }, { kind: "expense", title: "Expense categories" }];

/**
 * "Manage categories" dialog: income and expense lists side by side in meaning, separate on screen.
 * Add, rename and archive/restore; nothing is deleted, and records keep their category even after
 * it's renamed or archived. The lists refresh from the server after each change.
 */
export function ManageCategoriesDialog({ clubId, categories }: { clubId: string; categories: ClubCategories }) {
  return (
    <FormDialog label="Manage categories" title="Finance categories" description="Categories group your income and expenses. Archived categories stay on past records but can't be chosen for new ones." noticeParams={() => ({})} modalClassName="sm:max-w-2xl" trigger={{ icon: "none", variant: "outline", size: "sm" }}>
      <CategoryManager clubId={clubId} categories={categories} />
    </FormDialog>
  );
}

function CategoryManager({ clubId, categories }: { clubId: string; categories: ClubCategories }) {
  const { close } = useFormDialog();
  return (
    <div className="space-y-8">
      {KINDS.map(({ kind, title }) => <CategoryList key={kind} clubId={clubId} kind={kind} title={title} items={categories[kind]} />)}
      <div className="flex justify-end border-t border-border pt-5"><Button type="button" variant="outline" onClick={close}>Done</Button></div>
    </div>
  );
}

function CategoryList({ clubId, kind, title, items }: { clubId: string; kind: TransactionKind; title: string; items: CategoryOption[] }) {
  const headingId = useId();
  const active = items.filter((c) => !c.archived);
  const archived = items.filter((c) => c.archived);
  return (
    <section aria-labelledby={headingId}>
      <h3 id={headingId} className="form-legend !mb-3 flex items-center gap-2">{title} <span className="text-xs font-semibold text-slate-500 tabular-nums">{active.length} active</span></h3>
      <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border">
        {[...active, ...archived].map((c) => <CategoryRow key={c.value} clubId={clubId} kind={kind} category={c} lastActive={!c.archived && active.length <= 1} />)}
      </ul>
      <AddCategoryForm clubId={clubId} kind={kind} />
    </section>
  );
}

function CategoryRow({ clubId, kind, category, lastActive }: { clubId: string; kind: TransactionKind; category: CategoryOption; lastActive: boolean }) {
  const inputId = useId();
  const [editing, setEditing] = useState(false);
  const rename = useMemo(() => renameCategory.bind(null, clubId, kind, category.value), [clubId, kind, category.value]);
  const [state, formAction, renaming] = useActionState<FormState, FormData>(rename, {});
  const [archiveState, setArchiveState] = useState<FormState>({});
  const [archiving, startArchive] = useTransition();

  // Leave edit mode once a rename is saved (the list refreshes with the new name).
  useEffect(() => { if (state.saved) setEditing(false); }, [state]);

  const toggleArchive = () => startArchive(async () => setArchiveState(await setCategoryArchived(clubId, kind, category.value, !category.archived)));
  const error = (editing && state.error) || archiveState.error;

  return (
    <li className={category.archived ? "bg-slate-50/70" : undefined}>
      {editing ? (
        <form action={formAction} className="flex flex-wrap items-center gap-2 px-3 py-2.5 sm:px-4">
          <label htmlFor={inputId} className="sr-only">New name for {category.label}</label>
          <Input id={inputId} name="label" defaultValue={state.values?.label ?? category.label} maxLength={60} required autoFocus aria-invalid={!!state.fieldErrors?.label} className="h-9 min-w-0 flex-1 basis-48" />
          <div className="flex gap-1.5">
            <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(false)} disabled={renaming}>Cancel</Button>
            <Button type="submit" size="sm" disabled={renaming}>{renaming ? "Saving…" : "Save"}</Button>
          </div>
        </form>
      ) : (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-3 py-2.5 sm:px-4">
          <span className={`min-w-0 flex-1 break-words text-sm font-medium ${category.archived ? "text-slate-500" : ""}`}>{category.label}</span>
          {category.archived && <Badge>Archived</Badge>}
          {category.custom && !category.archived && <Badge tone="brand">Custom</Badge>}
          <div className="flex gap-0.5">
            {!category.archived && <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(true)} aria-label={`Rename ${category.label}`} title="Rename" className="min-w-9 px-2.5"><Pencil size={15} aria-hidden /></Button>}
            <Button type="button" variant="ghost" size="sm" onClick={toggleArchive} disabled={archiving || lastActive} aria-label={`${category.archived ? "Restore" : "Archive"} ${category.label}`} title={lastActive ? "Keep at least one active category" : category.archived ? "Restore" : "Archive"} className="min-w-9 px-2.5">
              {category.archived ? <><RotateCcw size={15} aria-hidden /> Restore</> : <Archive size={15} aria-hidden />}
            </Button>
          </div>
        </div>
      )}
      {error && <p role="alert" className="px-3 pb-2.5 text-[0.8125rem] font-medium text-red-700 sm:px-4">{state.fieldErrors?.label?.[0] ?? error}</p>}
    </li>
  );
}

function AddCategoryForm({ clubId, kind }: { clubId: string; kind: TransactionKind }) {
  const inputId = useId();
  const add = useMemo(() => addCategory.bind(null, clubId, kind), [clubId, kind]);
  const [state, formAction, pending] = useActionState<FormState, FormData>(add, {});
  const [round, setRound] = useState(0);
  // Clear the field after each successful add.
  useEffect(() => { if (state.success) setRound((r) => r + 1); }, [state]);
  return (
    <form key={round} action={formAction} className="mt-3">
      <label htmlFor={inputId} className="sr-only">New {kind === "income" ? "income" : "expense"} category</label>
      <div className="flex gap-2">
        <Input id={inputId} name="label" defaultValue={state.success ? "" : state.values?.label ?? ""} maxLength={60} placeholder={kind === "income" ? "e.g. Seminar fees" : "e.g. Insurance"} aria-invalid={!!state.fieldErrors?.label} className="h-10 min-w-0 flex-1" />
        <Button type="submit" variant="outline" disabled={pending} className="min-h-10 shrink-0 px-4"><Plus size={16} aria-hidden /> {pending ? "Adding…" : "Add"}</Button>
      </div>
      {(state.error || state.fieldErrors?.label) && <p role="alert" className="mt-1.5 text-[0.8125rem] font-medium text-red-700">{state.fieldErrors?.label?.[0] ?? state.error}</p>}
      {state.success && <p role="status" className="mt-1.5 text-[0.8125rem] text-emerald-800">{state.success}</p>}
    </form>
  );
}
