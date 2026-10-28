/**
 * GET /media/images/<project>/<dataset>/<sha1>-<w>x<h>.<ext>?<params>
 * GET /media/files/<project>/<dataset>/<sha1>.<ext>[?dl=<name>]
 *
 * The website's images and files (the `media` table), at the URL shape of
 * the Sanity CDN, so @sanity/image-url (src/sanity/image.ts) builds them.
 * Images take the CDN parameters we use (rect, w, h, fit, crop, fp-x, fp-y,
 * q, fm, auto=format); each derivative is made once with sharp and kept
 * under UPLOAD_DIR/media-cache/. The URL names its bytes, so everything is
 * cached for a year. Unknown ids are 404.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { uploadDir } from "@/lib/bulletin/storage";
import {
  formatMime,
  idFromFileName,
  isIdentity,
  mediaAbsPath,
  parseTransform,
  render,
  transformKey,
  writeAtomic,
  type Format,
} from "@/lib/content/storage";

const IMMUTABLE = "public, max-age=31536000, immutable";

const notFound = () =>
  new Response("Not found", { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });

const FORMAT_OF: Record<string, Format> = { jpg: "jpg", jpeg: "jpg", png: "png", webp: "webp", avif: "avif" };

/** "Ime datoteke.pdf" → a Content-Disposition header (ASCII fallback + UTF-8 name). */
function disposition(kind: "inline" | "attachment", name: string): string {
  const ascii = name.normalize("NFD").replace(/[^\x20-\x7e]/g, "").replace(/["\\]/g, "") || "datoteka";
  return `${kind}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(name)}`;
}

export async function GET(request: Request, { params }: { params: Promise<{ kind: string; project: string; dataset: string; file: string }> }) {
  const { kind, file } = await params;
  const id = idFromFileName(kind, file);
  if (!id) return notFound();
  const url = new URL(request.url);

  // A derivative made before is sent straight from the cache: no database, no original.
  const ext = id.slice(id.lastIndexOf("-") + 1).toLowerCase();
  const originalFormat = FORMAT_OF[ext];
  const t = kind === "images" && originalFormat ? parseTransform(url.searchParams, originalFormat) : null;
  const cacheFile = t && !isIdentity(t, originalFormat!) ? path.join(/*turbopackIgnore: true*/ uploadDir(), "media-cache", id, `${transformKey(t)}.${t.format}`) : null;
  if (t && cacheFile) {
    const hit = await readFile(cacheFile).catch(() => null);
    if (hit) return derivative(hit, t.format);
  }

  const [row] = await db.select().from(schema.media).where(eq(schema.media.id, id));
  if (!row) return notFound();

  let original: Buffer;
  try {
    original = await readFile(mediaAbsPath(row.path));
  } catch {
    return notFound();
  }

  if (row.kind === "file") {
    const dl = url.searchParams.get("dl");
    const name = dl || row.filename || file;
    return new Response(new Uint8Array(original), {
      headers: {
        "Content-Type": row.mime,
        "Content-Length": String(original.byteLength),
        "Content-Disposition": disposition(dl != null ? "attachment" : "inline", name),
        "Cache-Control": IMMUTABLE,
      },
    });
  }

  // Formats sharp doesn't write (gif, svg …) and untouched originals are sent as they are.
  if (!t || !cacheFile) {
    return new Response(new Uint8Array(original), { headers: { "Content-Type": row.mime, "Cache-Control": IMMUTABLE } });
  }

  let out: Buffer;
  try {
    out = await render(original, t);
  } catch {
    return notFound();
  }
  await writeAtomic(cacheFile, out).catch(() => {});
  return derivative(out, t.format);
}

function derivative(bytes: Buffer, format: Format) {
  return new Response(new Uint8Array(bytes), {
    headers: { "Content-Type": formatMime(format), "Content-Length": String(bytes.byteLength), "Cache-Control": IMMUTABLE },
  });
}
