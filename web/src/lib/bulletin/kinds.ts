/** Allowed upload kinds (FR-15). No server imports, so scripts can use it. */
import path from "node:path";

/** Extension → canonical MIME type. */
export const UPLOAD_TYPES = {
  jpg: "image/jpeg",
  png: "image/png",
  heic: "image/heic",
  webp: "image/webp",
  pdf: "application/pdf",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  csv: "text/csv",
  ods: "application/vnd.oasis.opendocument.spreadsheet",
} as const;
export type UploadExt = keyof typeof UPLOAD_TYPES;

const EXT_ALIASES: Record<string, UploadExt> = { jpeg: "jpg", jpe: "jpg", heif: "heic" };
const MIME_ALIASES: Record<string, UploadExt> = { "image/jpg": "jpg", "image/pjpeg": "jpg", "image/heif": "heic", "application/csv": "csv", "text/plain": "csv" };

/** The upload's kind from its MIME type, else its extension; null = not allowed. */
export function uploadKind(name: string, type: string): UploadExt | null {
  const mime = type.toLowerCase().split(";")[0].trim();
  const byMime = (Object.entries(UPLOAD_TYPES).find(([, m]) => m === mime)?.[0] as UploadExt | undefined) ?? MIME_ALIASES[mime];
  const ext = path.extname(name).slice(1).toLowerCase();
  const byExt = ext in UPLOAD_TYPES ? (ext as UploadExt) : EXT_ALIASES[ext];
  // "text/plain" alone is not enough: only a .csv name makes it a CSV.
  if (mime === "text/plain") return byExt === "csv" ? "csv" : null;
  return byMime ?? (mime === "" || mime === "application/octet-stream" ? byExt ?? null : null);
}

export const isSheet = (kind: string) => kind === "xlsx" || kind === "ods" || kind === "csv";
