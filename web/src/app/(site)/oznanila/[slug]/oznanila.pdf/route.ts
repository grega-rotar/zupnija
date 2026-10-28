/**
 * GET /oznanila/<period_start>/oznanila.pdf — the original PDF of a
 * published bulletin ("Prenesi PDF"). Anything else is 404: unpublished
 * bulletins, uploads that are photos or spreadsheets, unknown periods. The
 * segment is [slug] because it shares /oznanila/[slug] with announcements.
 *
 * Cached by browsers and proxies for an hour, revalidated with the ETag
 * (the upload's sha256): a corrected bulletin is a new upload, so a new ETag.
 */
import { readFile } from "node:fs/promises";
import { getPublishedPdf } from "@/lib/data/bulletins";
import { uploadPath } from "@/lib/bulletin/storage";

const SLUG: Record<string, string> = { č: "c", š: "s", ž: "z", ć: "c", đ: "d" };
const fileSlug = (title: string) =>
  title
    .toLowerCase()
    .replace(/[čšžćđ]/g, (c) => SLUG[c])
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "oznanila";

const notFound = () => new Response("Not found", { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });

export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }): Promise<Response> {
  const { slug } = await params;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(slug)) return notFound();
  const pdf = await getPublishedPdf(slug);
  if (!pdf) return notFound();

  const etag = `"${pdf.sha256}"`;
  const headers = {
    "Content-Type": "application/pdf",
    "Content-Disposition": `inline; filename="oznanila-${fileSlug(pdf.title)}.pdf"`,
    "Cache-Control": "public, max-age=3600, must-revalidate",
    ETag: etag,
    "X-Content-Type-Options": "nosniff",
  };
  const match = request.headers.get("if-none-match");
  if (match && match.split(",").some((t) => t.trim().replace(/^W\//, "") === etag)) return new Response(null, { status: 304, headers });

  let bytes: Buffer;
  try {
    bytes = await readFile(uploadPath(pdf));
  } catch {
    return notFound();
  }
  return new Response(new Uint8Array(bytes), { status: 200, headers: { ...headers, "Content-Length": String(bytes.byteLength) } });
}
