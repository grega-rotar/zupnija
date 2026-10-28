/**
 * Bulletin uploads on disk (FR-15): under UPLOAD_DIR (default ./.uploads),
 * named by sha256, at most 20 MB, only jpeg/png/heic/webp/pdf/xlsx/csv/ods.
 * Never served publicly.
 */
import "server-only";
import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { db, schema } from "@/db";
import { UserError } from "@/lib/admin/errors";
import { now } from "@/lib/clock";
import { UPLOAD_TYPES, uploadKind } from "./kinds";

export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;
export const TOO_BIG = "Datoteka je prevelika (največ 20 MB).";
export const BAD_TYPE = "Te vrste datoteke ne znam prebrati.";

export { UPLOAD_TYPES, uploadKind, isSheet, type UploadExt } from "./kinds";

export type UploadInput = File | { name: string; type: string; bytes: Uint8Array };
export type Upload = typeof schema.uploads.$inferSelect;

export function uploadDir(): string {
  // A runtime folder (/data/uploads in production), so the build must not trace it.
  return path.resolve(/*turbopackIgnore: true*/ process.env.UPLOAD_DIR ?? "./.uploads");
}

/** Absolute path of a stored upload. */
export function uploadPath(u: Pick<Upload, "path">): string {
  return path.join(/*turbopackIgnore: true*/ uploadDir(), u.path);
}

/** Validate and store an upload. Throws UserError for size or type. */
export async function saveUpload(file: UploadInput, actor: { id: string }): Promise<Upload> {
  const size = file instanceof File ? file.size : file.bytes.byteLength;
  if (size > MAX_UPLOAD_BYTES) throw new UserError(TOO_BIG);
  const kind = uploadKind(file.name, file.type);
  if (!kind) throw new UserError(BAD_TYPE);
  const bytes = file instanceof File ? new Uint8Array(await file.arrayBuffer()) : file.bytes;
  if (bytes.byteLength > MAX_UPLOAD_BYTES) throw new UserError(TOO_BIG);

  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const rel = path.join(/*turbopackIgnore: true*/ sha256.slice(0, 2), `${sha256}.${kind}`);
  const abs = path.join(/*turbopackIgnore: true*/ uploadDir(), rel);
  await mkdir(path.dirname(abs), { recursive: true });
  await writeFile(abs, bytes);

  const [row] = await db
    .insert(schema.uploads)
    .values({ filename: file.name || `oznanila.${kind}`, mime: UPLOAD_TYPES[kind], size: bytes.byteLength, path: rel, sha256, uploadedBy: actor.id, createdAt: now() })
    .returning();
  return row;
}
