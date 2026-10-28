"use client";

/*
 * Client side of an upload: checks the file, sends it to the `uploadMedia`
 * server action (lib/content/media.ts; sha256 dedupe, no history) and
 * remembers the URL, name and size of what it uploaded, so the fields can show
 * them for asset ids they only know by reference.
 */
import { uploadMedia } from "@/lib/content/media";
import { assetUrl, checkFile, type UploadedMedia } from "./ImageField.media";

export type Uploader = (file: File) => Promise<UploadedMedia>;

type Known = { url?: string; filename?: string | null; size?: number | null };
const known = new Map<string, Known>();

/** URL, name and size of an asset, as far as this tab knows them. */
export function knownAsset(id: string | null | undefined): Known {
  if (!id) return {};
  return { url: assetUrl(id) ?? undefined, ...known.get(id) };
}

export function rememberAsset(id: string, info: Known) {
  known.set(id, { ...known.get(id), ...info });
}

/** The real uploader (the server action). */
export const defaultUpload: Uploader = async (file) => {
  const form = new FormData();
  form.set("file", file);
  const res = (await uploadMedia(form)) as UploadedMedia | { error: string };
  if ("error" in res) throw new Error(res.error);
  return res;
};

/** Checks, uploads, remembers. Throws an Error with a Slovenian message. */
export async function uploadChecked(upload: Uploader, file: File, kind: "image" | "file", accept?: string): Promise<UploadedMedia> {
  const problem = checkFile(file, kind, accept);
  if (problem) throw new Error(problem);
  let res: UploadedMedia;
  try {
    res = await upload(file);
  } catch (e) {
    const msg = e instanceof Error && e.message && !/fetch|network|unexpected/i.test(e.message) ? e.message : null;
    throw new Error(msg ?? "Nalaganje ni uspelo. Preverite povezavo in poskusite znova.");
  }
  rememberAsset(res.id, { url: res.url, filename: res.filename ?? file.name, size: file.size });
  return res;
}
