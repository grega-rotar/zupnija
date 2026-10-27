"use server";

import "@/lib/admin/next";
import { eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { db, schema } from "@/db";
import { undo } from "@/lib/admin/registry";
import { toResult, UserError, type ActionResult } from "@/lib/admin/errors";
import { requireActor } from "@/lib/admin/session";

/** Undo one change (the toast's "Razveljavi"). Returns the toast text. */
export async function undoHistory(historyId: number): Promise<ActionResult<{ historyId: number; label: string }>> {
  const res = await toResult(async () => {
    const actor = await requireActor();
    if (!Number.isInteger(historyId)) throw new UserError("Te spremembe ni več mogoče razveljaviti.");
    const out = await undo(actor, historyId);
    const [h] = await db
      .select({ label: schema.history.label })
      .from(schema.history)
      .where(eq(schema.history.id, out.historyId));
    return { historyId: out.historyId, label: h?.label ?? "Razveljavljeno." };
  });
  if (res.ok) refresh();
  return res;
}

/** "Večje črke" on the profile sheet: stored on the user row (FR-16). */
export async function setBigText(on: boolean): Promise<ActionResult<{ bigText: boolean }>> {
  const res = await toResult(async () => {
    const actor = await requireActor();
    const bigText = on === true;
    await db.update(schema.user).set({ bigText }).where(eq(schema.user.id, actor.id));
    return { bigText };
  });
  if (res.ok) refresh();
  return res;
}
