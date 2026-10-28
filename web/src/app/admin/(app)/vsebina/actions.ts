"use server";

import "@/lib/admin/next";
import { refresh } from "next/cache";
import { perform } from "@/lib/admin/registry";
import { toResult, type ActionResult } from "@/lib/admin/errors";
import { requireActor } from "@/lib/admin/session";
import type { Doc } from "@/lib/content/fields";

/*
 * The Spletna stran screens' server actions. Each one is a thin wrapper over
 * an engine action from lib/content/actions.ts (content.save, .delete,
 * .reorder, .publish): perform() checks the area, validates the payload with
 * the type's zod schema and, for helpers who need approval, queues it.
 */

export type ContentDone = { status: "applied"; historyId: number } | { status: "pending" };
export type ContentSaved = { status: "applied"; historyId: number; id: string } | { status: "pending" };

async function run<T>(name: string, payload: unknown, done: (out: Awaited<ReturnType<typeof perform>>) => T): Promise<ActionResult<T>> {
  const res = await toResult(async () => done(await perform(await requireActor(), name, payload)));
  if (res.ok) refresh();
  return res;
}

const applied = (out: Awaited<ReturnType<typeof perform>>): ContentDone =>
  out.status === "applied" ? { status: "applied", historyId: out.historyId } : { status: "pending" };

/** "Shrani": creates (no id) or replaces one document. A new document's id comes back for the URL. */
export async function saveContent(input: { id?: string; type: string; data: Doc }): Promise<ActionResult<ContentSaved>> {
  return run("content.save", input, (out) => {
    if (out.status !== "applied") return { status: "pending" as const };
    const row = out.result as { id?: string } | null | undefined;
    return { status: "applied" as const, historyId: out.historyId, id: row?.id ?? input.id ?? "" };
  });
}

/** "Izbriši" in the form's overflow menu (owner only; refused while other documents point here). */
export async function deleteContent(id: string): Promise<ActionResult<ContentDone>> {
  return run("content.delete", { id }, applied);
}

/** Dragging a row in an orderable list. */
export async function reorderContent(type: string, ids: string[]): Promise<ActionResult<ContentDone>> {
  return run("content.reorder", { type, ids }, applied);
}

/** "Skrij s strani" / "Objavi" in the overflow menu. */
export async function publishContent(id: string, published: boolean): Promise<ActionResult<ContentDone>> {
  return run("content.publish", { id, published }, applied);
}
