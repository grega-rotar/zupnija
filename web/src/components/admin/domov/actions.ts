"use server";

import "@/lib/admin/next";
import { refresh } from "next/cache";
import { approve, reject } from "@/lib/admin/registry";
import { ForbiddenError, toResult, UserError, type ActionResult } from "@/lib/admin/errors";
import { requireActor } from "@/lib/admin/session";

/** The priest approves one helper's change; it is applied and published. */
export async function approveChange(id: number): Promise<ActionResult<{ historyId: number }>> {
  const res = await toResult(async () => {
    const actor = await requireActor();
    if (!actor.isOwner) throw new ForbiddenError();
    return approve(actor, id);
  });
  refresh();
  return res;
}

/** The priest rejects one helper's change; nothing is published. */
export async function rejectChange(id: number): Promise<ActionResult<null>> {
  const res = await toResult(async () => {
    const actor = await requireActor();
    if (!actor.isOwner) throw new ForbiddenError();
    await reject(actor, id);
    return null;
  });
  refresh();
  return res;
}

/**
 * "Potrdi vse": approves exactly the rows the priest saw, in order. Stops at
 * the first one that can no longer be applied and says which.
 */
export async function approveAll(ids: number[]): Promise<ActionResult<{ historyIds: number[] }>> {
  const res = await toResult(async () => {
    const actor = await requireActor();
    if (!actor.isOwner) throw new ForbiddenError();
    if (!Array.isArray(ids) || !ids.every((x) => Number.isInteger(x))) throw new UserError("Neveljavni podatki.");
    const historyIds: number[] = [];
    for (const id of ids) {
      try {
        historyIds.push((await approve(actor, id)).historyId);
      } catch (e) {
        if (e instanceof UserError && historyIds.length) {
          throw new UserError(`Potrjeno ${historyIds.length} od ${ids.length}. ${e.message}`);
        }
        throw e;
      }
    }
    return { historyIds };
  });
  refresh();
  return res;
}
