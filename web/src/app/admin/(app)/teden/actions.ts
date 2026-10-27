"use server";

import "@/lib/admin/next";
import { and, eq } from "drizzle-orm";
import { refresh, revalidateTag } from "next/cache";
import { db, schema } from "@/db";
import { perform } from "@/lib/admin/registry";
import { toResult, UserError, type ActionResult } from "@/lib/admin/errors";
import { requireArea } from "@/lib/admin/session";
import type { IntentionKind } from "@/lib/mase/format";

/** `historyId` is set when the change was applied (the toast offers "Razveljavi"); `pending` when it waits for the priest. */
export type MassChange = { historyId: number | null; pending: boolean };

async function run(name: string, payload: unknown): Promise<ActionResult<MassChange>> {
  const res = await toResult(async () => {
    const actor = await requireArea("mase");
    const out = await perform(actor, name, payload);
    return out.status === "applied" ? { historyId: out.historyId, pending: false } : { historyId: null, pending: true };
  });
  if (res.ok) refresh();
  return res;
}

export async function addIntention(massId: number, text: string, kind: IntentionKind) {
  return run("intention.add", { massId, text, kind });
}

export async function removeIntention(intentionId: number) {
  return run("intention.remove", { intentionId });
}

export async function cancelMass(massId: number, reason: string, intentionHandling: "next" | "keep" | null) {
  return run("mass.cancel", { massId, reason: reason.trim() || undefined, intentionHandling: intentionHandling ?? undefined });
}

export async function restoreMass(massId: number) {
  return run("mass.restore", { massId });
}

/**
 * A helper takes back her own intention that still waits for the priest
 * (the × next to "čaka" in the Mass panel). Nothing was applied yet, so the
 * request row is simply deleted; there is nothing to undo.
 */
export async function withdrawIntention(changeRequestId: number): Promise<ActionResult<MassChange>> {
  const res = await toResult(async () => {
    const actor = await requireArea("mase");
    const cr = schema.changeRequests;
    const gone = await db
      .delete(cr)
      .where(
        and(
          eq(cr.id, changeRequestId),
          eq(cr.createdBy, actor.id),
          eq(cr.status, "pending"),
          eq(cr.action, "intention.add"),
        ),
      )
      .returning({ id: cr.id });
    if (!gone.length) throw new UserError("Ta namen je že obravnavan.");
    revalidateTag("approvals", "max");
    return { historyId: null, pending: false };
  });
  if (res.ok) refresh();
  return res;
}
