/**
 * An uploaded bulletin file for the editor's source preview (FR-15): only for
 * signed-in people with the oznanila section, never public, never cached by
 * shared caches. On the admin host the URL is /oznanila/datoteka/<uploadId>.
 */
import { readFile } from "node:fs/promises";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { getActor } from "@/lib/admin/session";
import { can } from "@/lib/admin/sections";
import { uploadPath } from "@/lib/bulletin/storage";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const actor = await getActor();
  if (!actor) return new Response("Unauthorized", { status: 401 });
  if (!can(actor, "oznanila")) return new Response("Forbidden", { status: 403 });

  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) return new Response("Not Found", { status: 404 });
  const [u] = await db.select().from(schema.uploads).where(eq(schema.uploads.id, id));
  if (!u) return new Response("Not Found", { status: 404 });

  let bytes: Buffer;
  try {
    bytes = await readFile(uploadPath(u));
  } catch {
    return new Response("Not Found", { status: 404 });
  }
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": u.mime,
      "Content-Length": String(bytes.byteLength),
      "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(u.filename)}`,
      "Cache-Control": "private, max-age=3600",
      "X-Content-Type-Options": "nosniff",
      // The review shows a PDF in an <object> on the same admin host; nobody else may frame it.
      "X-Frame-Options": "SAMEORIGIN",
      // Chrome's PDF viewer doesn't run in a sandboxed document.
      ...(u.mime === "application/pdf" ? {} : { "Content-Security-Policy": "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox" }),
    },
  });
}
