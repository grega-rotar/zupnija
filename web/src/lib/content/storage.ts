/**
 * Website media on disk (tasks/contract-content.md): originals under
 * UPLOAD_DIR/media/<sha1[0..2]>/<id>.<ext>, resized derivatives under
 * UPLOAD_DIR/media-cache/. Ids keep Sanity's asset format, so a URL names
 * its bytes and every response can be cached forever.
 *
 *   image-<sha1>-<w>x<h>-<ext>   ↔  /media/images/<project>/<dataset>/<sha1>-<w>x<h>.<ext>
 *   file-<sha1>-<ext>            ↔  /media/files/<project>/<dataset>/<sha1>.<ext>
 */
import "server-only";
import { createHash } from "node:crypto";
import { mkdir, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp, { type Metadata } from "sharp";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { UserError } from "@/lib/admin/errors";
import { uploadDir } from "@/lib/bulletin/storage";
import { now } from "@/lib/clock";
import { mediaUrl } from "./read";

export type MediaKind = "image" | "file";

/** "media/ab/<id>.<ext>", relative to UPLOAD_DIR (same rule as scripts/import-sanity-content-lib.mjs). */
export function mediaRelPath(id: string): string {
  const parts = id.split("-");
  return path.join("media", parts[1].slice(0, 2), `${id}.${parts[parts.length - 1]}`);
}

export const mediaAbsPath = (rel: string) => path.join(/*turbopackIgnore: true*/ uploadDir(), rel);

/** The media id a /media URL's last segment names, or null. */
export function idFromFileName(kind: string, file: string): string | null {
  if (kind === "images") {
    const m = /^([a-f0-9]{40})-(\d+x\d+)\.([a-z0-9]+)$/i.exec(file);
    return m ? `image-${m[1]}-${m[2]}-${m[3]}` : null;
  }
  if (kind === "files") {
    const m = /^([a-f0-9]{40})\.([a-z0-9]+)$/i.exec(file);
    return m ? `file-${m[1]}-${m[2]}` : null;
  }
  return null;
}

/** Write a file atomically (a derivative may be requested twice at once). */
export async function writeAtomic(abs: string, bytes: Uint8Array): Promise<void> {
  await mkdir(path.dirname(abs), { recursive: true });
  const tmp = `${abs}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(tmp, bytes);
  await rename(tmp, abs);
}

// ── Derivatives (the Sanity image CDN's parameters we use) ─────────────────

export type Format = "jpg" | "png" | "webp" | "avif";
const MIME: Record<Format, string> = { jpg: "image/jpeg", png: "image/png", webp: "image/webp", avif: "image/avif" };
export const formatMime = (f: Format) => MIME[f];

const MAX_SIDE = 4000;
const int = (v: string | null, max = MAX_SIDE) => {
  const n = v == null ? NaN : Math.round(Number(v));
  return Number.isFinite(n) && n > 0 ? Math.min(n, max) : null;
};
const unit = (v: string | null) => {
  const n = v == null ? NaN : Number(v);
  return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : null;
};

export type Transform = {
  rect: [number, number, number, number] | null;
  w: number | null;
  h: number | null;
  fit: string;
  crop: string | null;
  fpX: number | null;
  fpY: number | null;
  q: number;
  format: Format;
};

/**
 * The transform a query string asks for. auto=format → WebP for everyone
 * (every browser the parish uses reads it, and one answer per URL lets
 * Cloudflare cache it; AVIF is too slow to encode on first view).
 * `original` is the stored format.
 */
export function parseTransform(sp: URLSearchParams, original: Format): Transform {
  const rectParts = (sp.get("rect") ?? "").split(",").map((x) => Math.round(Number(x)));
  const rect = rectParts.length === 4 && rectParts.every((n) => Number.isFinite(n) && n >= 0) && rectParts[2] > 0 && rectParts[3] > 0
    ? (rectParts as Transform["rect"])
    : null;
  const fm = sp.get("fm");
  const format: Format =
    fm === "jpg" || fm === "png" || fm === "webp" || fm === "avif"
      ? fm
      : sp.get("auto") === "format"
        ? "webp"
        : original;
  return {
    rect,
    w: int(sp.get("w")),
    h: int(sp.get("h")),
    fit: sp.get("fit") ?? "clip",
    crop: sp.get("crop"),
    fpX: unit(sp.get("fp-x")),
    fpY: unit(sp.get("fp-y")),
    q: int(sp.get("q"), 100) ?? 75,
    format,
  };
}

/** True when the original can be sent as it is. */
export const isIdentity = (t: Transform, original: Format) => !t.rect && !t.w && !t.h && t.format === original;

/** A stable name for a transform (the derivative's cache file). */
export function transformKey(t: Transform): string {
  return createHash("sha1").update(JSON.stringify(t)).digest("hex").slice(0, 20);
}

/** sharp's gravity for Sanity's `crop` (e.g. "top,left", "center", "entropy"). */
function gravity(crop: string | null): string | number {
  if (!crop) return "centre";
  const parts = crop.split(",");
  if (parts.includes("entropy")) return sharp.strategy.entropy;
  const v = parts.includes("top") ? "north" : parts.includes("bottom") ? "south" : "";
  const h = parts.includes("left") ? "west" : parts.includes("right") ? "east" : "";
  return v + h || "centre";
}

// At most two renders at once: each holds a decoded photo in memory and a CPU core.
let running = 0;
const waiting: (() => void)[] = [];
async function slot<T>(work: () => Promise<T>): Promise<T> {
  if (running >= 2) await new Promise<void>((go) => waiting.push(go));
  running++;
  try {
    return await work();
  } finally {
    running--;
    waiting.shift()?.();
  }
}

/**
 * Apply a transform with sharp, in one pipeline: the photo is decoded once
 * (large JPEGs shrink while decoding), oriented, cut, resized and encoded
 * once. Never re-encode the full-size original on the way.
 */
export function render(input: Buffer, t: Transform): Promise<Buffer> {
  return slot(() => renderNow(input, t));
}

async function renderNow(input: Buffer, t: Transform): Promise<Buffer> {
  // rect and sizes are in the upright image's pixels (EXIF orientation 5–8 swaps the sides).
  const meta = await sharp(input, { failOn: "none" }).metadata();
  const turned = (meta.orientation ?? 1) >= 5;
  let width = (turned ? meta.height : meta.width) ?? 1;
  let height = (turned ? meta.width : meta.height) ?? 1;
  let img = sharp(input, { failOn: "none", sequentialRead: true }).autoOrient();

  if (t.rect) {
    const [x, y, w, h] = t.rect;
    const left = Math.min(x, width - 1);
    const top = Math.min(y, height - 1);
    const rw = Math.min(w, width - left);
    const rh = Math.min(h, height - top);
    img = img.extract({ left, top, width: rw, height: rh }); // before resize: cut from the original
    width = rw;
    height = rh;
  }

  if (t.w || t.h) {
    if (t.fit === "crop" && t.w && t.h) {
      if (t.crop === "focalpoint" && t.fpX != null && t.fpY != null) {
        // Scale to cover, then cut the box centred on the focal point (extract after resize).
        const scale = Math.max(t.w / width, t.h / height);
        const sw = Math.max(t.w, Math.round(width * scale));
        const sh = Math.max(t.h, Math.round(height * scale));
        const left = Math.min(Math.max(0, Math.round(t.fpX * sw - t.w / 2)), sw - t.w);
        const top = Math.min(Math.max(0, Math.round(t.fpY * sh - t.h / 2)), sh - t.h);
        img = img.resize(sw, sh, { fit: "fill" }).extract({ left, top, width: t.w, height: t.h });
      } else {
        img = img.resize(t.w, t.h, { fit: "cover", position: gravity(t.crop) });
      }
    } else if (t.fit === "fill" && t.w && t.h) {
      img = img.resize(t.w, t.h, { fit: "contain", background: { r: 255, g: 255, b: 255, alpha: 1 } });
    } else if (t.fit === "scale" && t.w && t.h) {
      img = img.resize(t.w, t.h, { fit: "fill" });
    } else if (t.fit === "min" && t.w && t.h) {
      img = img.resize(t.w, t.h, { fit: "outside", withoutEnlargement: true });
    } else {
      // clip / max (the default): fit inside the box, never larger than the original.
      img = img.resize(t.w ?? undefined, t.h ?? undefined, { fit: "inside", withoutEnlargement: true });
    }
  }

  switch (t.format) {
    case "webp":
      return img.webp({ quality: t.q, effort: 4 }).toBuffer();
    case "avif":
      return img.avif({ quality: t.q }).toBuffer();
    case "png":
      return img.png().toBuffer();
    default:
      return img.jpeg({ quality: t.q, mozjpeg: true }).toBuffer();
  }
}

/** A tiny blurred placeholder (data URL) for an image, ~20px wide. */
export async function lqipOf(input: Buffer): Promise<string> {
  const b = await sharp(input, { failOn: "none" }).rotate().resize(20, 20, { fit: "inside" }).webp({ quality: 40 }).toBuffer();
  return `data:image/webp;base64,${b.toString("base64")}`;
}

// ── Uploads ────────────────────────────────────────────────────────────────

export const MAX_MEDIA_BYTES = 20 * 1024 * 1024;

/** Images sharp can read and the site can show, by extension → mime. */
const IMAGE_TYPES: Record<string, string> = { jpg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif", avif: "image/avif" };
/** Documents people download from the site. */
const FILE_TYPES: Record<string, string> = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  odt: "application/vnd.oasis.opendocument.text",
  ods: "application/vnd.oasis.opendocument.spreadsheet",
  jpg: "image/jpeg",
  png: "image/png",
};

export type UploadedMedia = { id: string; url: string; width: number | null; height: number | null; filename: string | null };

function extOf(name: string, mime: string): string {
  const fromName = /\.([a-z0-9]+)$/i.exec(name)?.[1]?.toLowerCase();
  const ext = fromName === "jpeg" ? "jpg" : fromName;
  if (ext) return ext;
  const fromMime = Object.entries({ ...FILE_TYPES, ...IMAGE_TYPES }).find(([, m]) => m === mime)?.[0];
  return fromMime ?? "";
}

/** Store an upload (uploadMedia in media.ts, after its permission check): dedupe by sha256, then file + media row. */
export async function storeMedia(
  input: { name: string; type: string; bytes: Buffer; kind?: "image" | "file" },
  userId: string | null,
): Promise<UploadedMedia> {
  const { name, type, bytes } = input;
  if (bytes.byteLength > MAX_MEDIA_BYTES) throw new UserError("Datoteka je prevelika (največ 20 MB).");
  const ext = extOf(name, type);
  const isImage = input.kind !== "file" && ext in IMAGE_TYPES;
  if (!isImage && !(ext in FILE_TYPES)) throw new UserError("Te vrste datoteke ni mogoče naložiti.");

  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const m = schema.media;
  const [dupe] = await db.select().from(m).where(eq(m.sha256, sha256));
  if (dupe && (dupe.kind === "image") === isImage) {
    return { id: dupe.id, url: mediaUrl(dupe.id)!, width: dupe.width, height: dupe.height, filename: dupe.filename };
  }

  const sha1 = createHash("sha1").update(bytes).digest("hex");
  let id: string;
  let width: number | null = null;
  let height: number | null = null;
  let lqip: string | null = null;
  if (isImage) {
    let meta: Metadata;
    try {
      meta = await sharp(bytes).metadata();
    } catch {
      throw new UserError("Te slike ni mogoče prebrati.");
    }
    if (!meta.width || !meta.height) throw new UserError("Te slike ni mogoče prebrati.");
    // EXIF orientations 5–8 turn the picture on its side: the site shows it upright.
    const turned = (meta.orientation ?? 1) >= 5;
    width = turned ? meta.height : meta.width;
    height = turned ? meta.width : meta.height;
    lqip = await lqipOf(bytes);
    id = `image-${sha1}-${width}x${height}-${ext}`;
  } else {
    id = `file-${sha1}-${ext}`;
  }

  const rel = mediaRelPath(id);
  await writeAtomic(mediaAbsPath(rel), bytes);
  const filename = name || null;
  await db
    .insert(m)
    .values({
      id,
      kind: isImage ? "image" : "file",
      path: rel,
      mime: isImage ? IMAGE_TYPES[ext] : FILE_TYPES[ext],
      size: bytes.byteLength,
      width,
      height,
      lqip,
      filename,
      sha256,
      createdBy: userId,
      createdAt: now(),
    })
    .onConflictDoNothing();
  return { id, url: mediaUrl(id)!, width, height, filename };
}
