"use server";

import "@/lib/admin/next";
import { refresh } from "next/cache";
import { perform } from "@/lib/admin/registry";
import { toResult, type ActionResult } from "@/lib/admin/errors";
import { requireArea } from "@/lib/admin/session";
import type { LessonCancelPayload, LessonRestorePayload } from "@/lib/verouk/actions";

export type LessonDone = { status: "applied"; historyId: number } | { status: "pending" };

async function run(name: "lesson.cancel" | "lesson.restore", payload: unknown): Promise<ActionResult<LessonDone>> {
  const res = await toResult(async (): Promise<LessonDone> => {
    const actor = await requireArea("verouk");
    const out = await perform(actor, name, payload);
    return out.status === "applied" ? { status: "applied", historyId: out.historyId } : { status: "pending" };
  });
  if (res.ok) refresh();
  return res;
}

/** "Potrdi odpoved" in the cancel panel: this week's lesson of one group odpade, with a message for parents. */
export async function cancelLessonFromPanel(input: LessonCancelPayload): Promise<ActionResult<LessonDone>> {
  return run("lesson.cancel", input);
}

/** "Vrni uro" on a cancelled lesson. */
export async function restoreLessonFromCard(input: LessonRestorePayload): Promise<ActionResult<LessonDone>> {
  return run("lesson.restore", input);
}
