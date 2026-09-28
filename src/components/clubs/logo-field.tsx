"use client";
import { useEffect, useId, useState } from "react";
import Image from "next/image";
import { useFormState } from "@/components/action-form";
import { LOGO_MAX_BYTES, LOGO_TYPES } from "@/lib/images";

const accept = Object.keys(LOGO_TYPES).join(",");

/** Logo picker with preview. Early size/type feedback only; the server checks the actual bytes. */
export function LogoField({ currentSrc }: { currentSrc?: string | null }) {
  const id = useId();
  const serverError = useFormState().fieldErrors?.logo?.[0];
  const [clientError, setClientError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);
  const error = clientError ?? serverError;
  const shown = preview ?? currentSrc;

  function onChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setClientError(null);
    setPreview(null);
    if (!file) return;
    const problem = file.size > LOGO_MAX_BYTES ? "Logos must be 2 MB or smaller." : !(file.type in LOGO_TYPES) ? "Upload a PNG, JPEG or WebP image." : null;
    if (problem) {
      setClientError(problem);
      event.target.value = "";
      return;
    }
    setPreview(URL.createObjectURL(file));
  }

  return (
    <div>
      <label htmlFor={id}>Club logo</label>
      <div className="mt-2 flex items-center gap-4">
        <div className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-2xl border border-border bg-muted text-xs text-slate-500">
          {shown ? <Image src={shown} alt="Logo preview" width={64} height={64} unoptimized className="size-16 object-cover" /> : "No logo"}
        </div>
        <input id={id} name="logo" type="file" accept={accept} onChange={onChange} aria-invalid={!!error} aria-describedby={`${id}-hint${error ? ` ${id}-error` : ""}`} className="block w-full text-sm file:mr-3 file:rounded-xl file:border file:border-border file:bg-white file:px-3 file:py-2 file:text-sm file:font-semibold" />
      </div>
      <p id={`${id}-hint`} className="mt-1.5 text-xs text-slate-500">Optional. PNG, JPEG or WebP, up to 2 MB. Only members of this club can see it.</p>
      {error && <p id={`${id}-error`} role="alert" className="mt-1.5 text-sm font-medium text-red-700">{error}</p>}
    </div>
  );
}
