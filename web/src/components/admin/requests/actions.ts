"use server";

import "@/lib/admin/next";
import { refresh } from "next/cache";
import { perform } from "@/lib/admin/registry";
import { toResult, type ActionResult } from "@/lib/admin/errors";
import { requireArea } from "@/lib/admin/session";
import type { Area } from "@/lib/admin/sections";

/** The editor inboxes of the public forms: status flips through the engine (Zgodovina, undo). */
async function run(area: Area, name: string, payload: unknown): Promise<ActionResult<{ historyId: number | null }>> {
  const res = await toResult(async () => {
    const actor = await requireArea(area);
    const out = await perform(actor, name, payload);
    return { historyId: out.status === "applied" ? out.historyId : null };
  });
  if (res.ok) refresh();
  return res;
}

/** "Zavrni" on an intention request, with an optional note. */
export async function declineIntentionRequest(requestId: number, note: string) {
  return run("mase", "intentionRequest.decline", { requestId, note: note.trim() || undefined });
}

/** "Označi kot rešeno" on a sacrament enquiry (Domov). */
export async function resolveSacramentRequest(requestId: number) {
  return run("zupnija", "sacramentRequest.resolve", { requestId });
}

/** The "Spletni vpis je odprt" switch on Verouk → Vpisi. */
export async function setEnrolmentOpen(open: boolean) {
  return run("verouk", "enrolment.setOpen", { open });
}
