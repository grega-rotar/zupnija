/*
 * Value shapes and pure helpers shared by ImageField, FileField and the
 * image/attachment blocks in RichTextField. Values are stored exactly as the
 * studio stored them (Sanity JSON), with asset ids of the same form
 * (image-<sha1>-<w>x<h>-<ext>, file-<sha1>-<ext>) served from our /media route.
 */

// The path segments @sanity/image-url puts in front of the file name; our /media route keeps the shape.
const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID || "hnwav9pa";
const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET || "production";

export type AssetRef = { _type: "reference"; _ref: string };
export type Hotspot = { _type: "sanity.imageHotspot"; x: number; y: number; width: number; height: number };

/** imageWithAlt: `{_type:"image", asset, alt, hotspot?, crop?}` (+ caption inside rich text). */
export type ImageValue = {
  _type: string;
  _key?: string;
  asset: AssetRef;
  alt?: string;
  caption?: string;
  hotspot?: Hotspot;
  crop?: Record<string, unknown>;
};

export type FileValue = { _type: "file"; _key?: string; asset: AssetRef };

/** What `uploadMedia` (lib/content/media.ts) returns. */
export type UploadedMedia = { id: string; url: string; width?: number | null; height?: number | null; filename?: string | null };

const IMAGE_ID = /^image-([a-f0-9]+)-(\d+)x(\d+)-([a-z0-9]+)$/i;
const FILE_ID = /^file-([a-f0-9]+)-([a-z0-9]+)$/i;

/** The /media URL of an asset id, as @sanity/image-url builds it (null for an unknown shape). */
export function assetUrl(id: string | null | undefined): string | null {
  if (!id) return null;
  const img = IMAGE_ID.exec(id);
  if (img) return `/media/images/${projectId}/${dataset}/${img[1]}-${img[2]}x${img[3]}.${img[4]}`;
  const file = FILE_ID.exec(id);
  if (file) return `/media/files/${projectId}/${dataset}/${file[1]}.${file[2]}`;
  return null;
}

/** Width and height from an image asset id. */
export function imageSize(id: string | null | undefined): { width: number; height: number } | null {
  const m = id ? IMAGE_ID.exec(id) : null;
  return m ? { width: Number(m[2]), height: Number(m[3]) } : null;
}

/** "PDF", "DOCX" … from an asset id or a file name. */
export function extension(idOrName: string | null | undefined): string | null {
  if (!idOrName) return null;
  const m = FILE_ID.exec(idOrName) ?? IMAGE_ID.exec(idOrName);
  if (m) return m[m.length - 1].toUpperCase();
  const dot = idOrName.lastIndexOf(".");
  return dot > 0 && dot < idOrName.length - 1 ? idOrName.slice(dot + 1).toUpperCase() : null;
}

const clamp01 = (n: number) => Math.min(1, Math.max(0, Number.isFinite(n) ? n : 0.5));
const round = (n: number) => Math.round(n * 1000) / 1000;

/**
 * The focal point as Sanity stores it. Only the centre decides how
 * @sanity/image-url crops; the box is the largest one centred on the point
 * that stays inside the image, so the studio would also accept it.
 */
export function hotspotAt(x: number, y: number): Hotspot {
  const cx = round(clamp01(x));
  const cy = round(clamp01(y));
  return {
    _type: "sanity.imageHotspot",
    x: cx,
    y: cy,
    width: round(Math.max(0.01, 2 * Math.min(cx, 1 - cx))),
    height: round(Math.max(0.01, 2 * Math.min(cy, 1 - cy))),
  };
}

/** A new upload replaces the asset; alt and caption stay, the focal point (for the old picture) goes. */
export function withImage(prev: ImageValue | null | undefined, uploaded: UploadedMedia, type = "image"): ImageValue {
  const next: ImageValue = { _type: prev?._type ?? type, asset: { _type: "reference", _ref: uploaded.id } };
  if (prev?._key) next._key = prev._key;
  if (prev?.alt) next.alt = prev.alt;
  if (prev?.caption) next.caption = prev.caption;
  return next;
}

export function fileValue(uploaded: UploadedMedia, key?: string): FileValue {
  return key
    ? { _type: "file", _key: key, asset: { _type: "reference", _ref: uploaded.id } }
    : { _type: "file", asset: { _type: "reference", _ref: uploaded.id } };
}

export const MAX_UPLOAD = 20 * 1024 * 1024;
export const IMAGE_ACCEPT = "image/jpeg,image/png,image/webp,image/gif,image/avif";
export const FILE_ACCEPT = ".pdf,.doc,.docx,.xls,.xlsx,.odt,.ods,.jpg,.jpeg,.png";

/** Why a picked file cannot be uploaded (Slovenian), or null when it can. */
export function checkFile(file: File, kind: "image" | "file", accept?: string): string | null {
  if (file.size > MAX_UPLOAD) return `Datoteka je prevelika (največ 20 MB).`;
  if (kind === "image" && !file.type.startsWith("image/")) return "To ni slika. Izberite JPG, PNG ali WebP.";
  if (kind === "file" && accept) {
    const ok = accept.split(",").some((a) => {
      const t = a.trim().toLowerCase();
      if (!t) return false;
      if (t.startsWith(".")) return file.name.toLowerCase().endsWith(t);
      if (t.endsWith("/*")) return file.type.startsWith(t.slice(0, -1));
      return file.type === t;
    });
    if (!ok) return `Te vrste datoteke ni mogoče naložiti (dovoljeno: ${accept.replaceAll(".", "").toUpperCase().replaceAll(",", ", ")}).`;
  }
  return null;
}
