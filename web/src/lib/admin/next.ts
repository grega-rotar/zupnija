/**
 * Next.js glue for the editor.
 *
 * 1. Importing this module connects the change engine to Next's cache: every
 *    tag an action lists is expired at once (updateTag).
 *    EVERY server action file ('use server') in the editor must import it,
 *    together with the action registry:
 *
 *      import "@/lib/admin/next";
 *      import { perform } from "@/lib/admin/registry";
 *
 * 2. `requirePageArea(area)` for admin pages: signed out → /prijava, no
 *    access to the area → "/" (Domov).
 */
import "server-only";
import { revalidateTag, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { setRevalidator } from "./engine";
import { ForbiddenError } from "./errors";
import { requireArea } from "./session";
import type { Actor, Area } from "./sections";

// updateTag expires the tag at once, so the public site shows the change on the
// next request (PRD US-014). It only works inside server actions, so anything
// else (route handlers, after()) falls back to an immediate revalidateTag.
setRevalidator((tag) => {
  try {
    updateTag(tag);
  } catch {
    revalidateTag(tag, { expire: 0 });
  }
});

/** For pages: the actor, or a redirect to Domov when the area isn't theirs. */
export async function requirePageArea(area: Area): Promise<Actor> {
  try {
    return await requireArea(area);
  } catch (e) {
    if (e instanceof ForbiddenError) redirect("/");
    throw e;
  }
}
