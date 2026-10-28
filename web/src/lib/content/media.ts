"use server";

/**
 * Uploading an image or file for the website (tasks/contract-content.md).
 * Not an engine action: the upload only stores the bytes and a `media` row
 * (deduplicated by sha256, no history); the media is "used" once a saved
 * document references it, and that save is the change history records.
 *
 * Ids keep Sanity's asset format, so @sanity/image-url and the /media route
 * treat new uploads exactly like the imported ones:
 *   image-<sha1>-<w>x<h>-<ext>, file-<sha1>-<ext>
 */
import { ForbiddenError, UserError } from "@/lib/admin/errors";
import { can } from "@/lib/admin/sections";
import { requireActor } from "@/lib/admin/session";
import { MAX_MEDIA_BYTES, storeMedia, type UploadedMedia } from "./storage";

export type { UploadedMedia };

/**
 * Store one upload. FormData: `file` (File) and optional `kind` ("image" |
 * "file"; images by default when the file is one). Returns the media, or
 * { error } with a Slovenian message.
 */
export async function uploadMedia(formData: FormData): Promise<UploadedMedia | { error: string }> {
  try {
    const actor = await requireActor();
    if (!can(actor, "vsebina") && !can(actor, "zupnija")) throw new ForbiddenError();
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) throw new UserError("Izberite datoteko.");
    if (file.size > MAX_MEDIA_BYTES) throw new UserError("Datoteka je prevelika (največ 20 MB).");
    const bytes = Buffer.from(await file.arrayBuffer());
    return await storeMedia({ name: file.name, type: file.type, bytes, kind: formData.get("kind") === "file" ? "file" : undefined }, actor.id);
  } catch (e) {
    if (e instanceof ForbiddenError) return { error: "Za to nimate dovoljenja." };
    if (e instanceof UserError) return { error: e.message };
    throw e;
  }
}
