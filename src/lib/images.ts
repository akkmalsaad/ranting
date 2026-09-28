// Logo uploads: checked by content, not by the browser-supplied MIME type or file name.
export const LOGO_MAX_BYTES = 2 * 1024 * 1024;
export const LOGO_TYPES = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" } as const;
export type LogoType = keyof typeof LOGO_TYPES;

/** Detects PNG, JPEG or WebP from the file signature; anything else (including SVG) is null. */
export function detectImageType(bytes: Uint8Array): LogoType | null {
  const starts = (sig: number[], offset = 0) => sig.every((b, i) => bytes[offset + i] === b);
  if (starts([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  if (starts([0xff, 0xd8, 0xff])) return "image/jpeg";
  if (starts([0x52, 0x49, 0x46, 0x46]) && starts([0x57, 0x45, 0x42, 0x50], 8)) return "image/webp";
  return null;
}

export type LogoCheck = { ok: true; type: LogoType; extension: string } | { ok: false; error: string };

/** Size and signature checks shared by the upload action (authoritative) and tests. */
export function checkLogo(bytes: Uint8Array): LogoCheck {
  if (bytes.byteLength === 0) return { ok: false, error: "The selected file is empty." };
  if (bytes.byteLength > LOGO_MAX_BYTES) return { ok: false, error: "Logos must be 2 MB or smaller." };
  const type = detectImageType(bytes);
  if (!type) return { ok: false, error: "Upload a PNG, JPEG or WebP image." };
  return { ok: true, type, extension: LOGO_TYPES[type] };
}
