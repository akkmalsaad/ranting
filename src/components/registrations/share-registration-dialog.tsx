"use client";
import { useEffect, useId, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Check, Copy, Download, Loader2, MessageCircle, RefreshCw } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { BranchSelect } from "@/components/finance/branch-select";
import { ModalHeader } from "@/components/form-dialog";
import { getRegistrationLink, replaceRegistrationLink, type RegistrationLinkResult } from "@/app/clubs/[clubId]/registrations/actions";

type Branch = { id: string; name: string };
const FAILED: RegistrationLinkResult = { ok: false, error: "We couldn't prepare the registration link. Please try again." };
const fileName = (branch: string) => `ranting-registration-${branch.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "branch"}.png`;

/**
 * "Send registration link" modal: pick a branch, then share that branch's registration link via
 * WhatsApp (prepared message; the owner picks the recipient and sends it), copy it, or download
 * its QR code. The server reuses the branch's active link, so opening this never creates new ones.
 */
export function ShareRegistrationDialog({ clubId, clubName, branches, initialBranchId, onClose }: { clubId: string; clubName: string; branches: Branch[]; initialBranchId?: string; onClose: () => void }) {
  const titleId = useId();
  const urlId = useId();
  const urlRef = useRef<HTMLInputElement>(null);
  const initial = branches.length === 1 ? branches[0].id : branches.some((b) => b.id === initialBranchId) ? (initialBranchId as string) : "";
  const [branchId, setBranchId] = useState(initial);
  const [links, setLinks] = useState<Record<string, RegistrationLinkResult>>({});
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);
  const [confirmReplace, setConfirmReplace] = useState(false);
  const [replacing, setReplacing] = useState(false);
  const branch = branches.find((b) => b.id === branchId);
  const current = branchId ? links[branchId] : undefined;

  // Load each branch's link once; results are kept per branch while the modal is open.
  useEffect(() => {
    if (!branchId || links[branchId]) return;
    let cancelled = false;
    getRegistrationLink(clubId, branchId)
      .then((result) => { if (!cancelled) setLinks((all) => ({ ...all, [branchId]: result })); })
      .catch(() => { if (!cancelled) setLinks((all) => ({ ...all, [branchId]: FAILED })); });
    return () => { cancelled = true; };
  }, [clubId, branchId, links]);

  function changeBranch(next: string) {
    setBranchId(next);
    setCopied(false);
    setCopyFailed(false);
    setConfirmReplace(false);
  }

  function retry() {
    setLinks((all) => { const next = { ...all }; delete next[branchId]; return next; });
  }

  async function copy(url: string) {
    setCopyFailed(false);
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // No Clipboard API (e.g. non-HTTPS local network address): select the field and try the legacy copy.
      urlRef.current?.select();
      if (!document.execCommand?.("copy")) { setCopyFailed(true); return; }
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function replace() {
    setReplacing(true);
    const result = await replaceRegistrationLink(clubId, branchId).catch(() => FAILED);
    setLinks((all) => ({ ...all, [branchId]: result }));
    setReplacing(false);
    setConfirmReplace(false);
    setCopied(false);
  }

  const options = [...(initial ? [] : [{ value: "", label: "Choose a branch" }]), ...branches.map((b) => ({ value: b.id, label: b.name }))];

  return (
    <Modal labelledBy={titleId} onDismiss={onClose} className="sm:max-w-2xl">
      <ModalHeader id={titleId} title="Send registration link" description="Parents register their child with this link. Each registration waits for your approval before the student is added." />

      {branches.length === 0 ? (
        <div className="rounded-xl bg-slate-50 px-4 py-3 text-sm ring-1 ring-inset ring-border">
          <p>Add a branch before sharing a registration link. Each link registers students for one branch.</p>
          <Link href={`/clubs/${clubId}/branches`} className="mt-3 inline-block font-semibold text-primary hover:underline">Go to Branches</Link>
        </div>
      ) : (
        <div className="space-y-5">
          <div className="max-w-sm"><BranchSelect name="branch" label="Branch" options={options} defaultValue={initial} onValueChange={changeBranch} /></div>

          {!branch ? (
            <p className="text-sm text-slate-600">Choose a branch to get its registration link.</p>
          ) : !current ? (
            <p role="status" className="flex items-center gap-2 text-sm text-slate-600"><Loader2 size={16} aria-hidden className="animate-spin motion-reduce:animate-none" /> Preparing the link…</p>
          ) : !current.ok ? (
            <div role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-800">
              <p>{current.error}</p>
              <Button type="button" variant="outline" size="sm" onClick={retry} className="mt-3">Try again</Button>
            </div>
          ) : (
            <div className="rounded-2xl border border-border p-4 sm:p-5">
              <p className="text-sm text-slate-600">Registration for <span className="font-semibold text-foreground">{clubName}</span> · <span className="font-semibold text-foreground">{branch.name}</span></p>
              <label htmlFor={urlId} className="mt-4">Registration link</label>
              <input ref={urlRef} id={urlId} readOnly value={current.url} onFocus={(e) => e.currentTarget.select()} className="mt-1.5 h-11 w-full rounded-xl border border-border bg-slate-50 px-3.5 text-sm focus-visible:border-primary focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/15" />
              {current.local && (
                <p className="mt-2 rounded-lg bg-amber-50 p-3 text-xs leading-5 text-amber-900">
                  This is a local development link. It only opens on this computer (or devices on your development network), not on parents&apos; phones. Set <code>SITE_URL</code> to your public address before sharing it for real.
                </p>
              )}
              <div className="mt-4 flex flex-wrap gap-2.5">
                <Button asChild>
                  <a href={`https://wa.me/?text=${encodeURIComponent(`Hello! Please register your child for ${clubName} (${branch.name}) using this link: ${current.url}`)}`} target="_blank" rel="noopener noreferrer"><MessageCircle size={16} aria-hidden /> Share via WhatsApp</a>
                </Button>
                <Button type="button" variant="outline" onClick={() => copy(current.url)}>{copied ? <><Check size={16} aria-hidden /> Copied</> : <><Copy size={16} aria-hidden /> Copy link</>}</Button>
                <Button asChild variant="outline"><a href={current.qr} download={fileName(branch.name)}><Download size={16} aria-hidden /> Download QR code</a></Button>
              </div>
              <p aria-live="polite" className="sr-only">{copied ? "Link copied." : ""}</p>
              {copyFailed && <p role="alert" className="mt-2 text-sm text-red-700">Couldn&apos;t copy automatically. Select the link above and copy it.</p>}
              <div className="mt-5 flex items-center gap-4">
                <Image src={current.qr} alt={`QR code for the ${branch.name} registration link`} width={128} height={128} unoptimized className="size-32 shrink-0 rounded-lg border border-border" />
                <p className="text-xs leading-5 text-slate-500">Print or display this QR code so parents can scan it with their phone camera.</p>
              </div>
              <div className="mt-5 border-t border-border pt-4 text-sm">
                {confirmReplace ? (
                  <div className="flex flex-wrap items-center gap-2.5">
                    <p className="w-full text-slate-600">The current link will stop working for anyone who already has it.</p>
                    <Button type="button" variant="destructive" size="sm" onClick={replace} disabled={replacing}>{replacing ? "Replacing…" : "Replace link"}</Button>
                    <Button type="button" variant="ghost" size="sm" onClick={() => setConfirmReplace(false)} disabled={replacing}>Keep current link</Button>
                  </div>
                ) : (
                  <button type="button" onClick={() => setConfirmReplace(true)} className="inline-flex items-center gap-1.5 font-semibold text-slate-600 hover:text-foreground"><RefreshCw size={14} aria-hidden /> Replace this link</button>
                )}
              </div>
            </div>
          )}
        </div>
      )}
      <div className="mt-6 flex justify-end"><Button type="button" variant="outline" onClick={onClose}>Close</Button></div>
    </Modal>
  );
}
