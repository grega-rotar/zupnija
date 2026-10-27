"use server";

import "@/lib/admin/next";
import "@/lib/admin/registry";
import { refresh } from "next/cache";
import { toResult, type ActionResult } from "@/lib/admin/errors";
import { requireArea } from "@/lib/admin/session";
import { invitePerson, revokeAccess, updateAccess, type PersonInvitePayload, type PersonUpdatePayload } from "@/lib/ljudje/actions";
import type { PerformResult } from "@/lib/admin/engine";

type Done = { historyId: number | null };
const historyId = (r: PerformResult) => (r.status === "applied" ? r.historyId : null);

/** Shrani on a person's panel: sections and "Spremembe potrdim jaz". */
export async function savePerson(payload: PersonUpdatePayload): Promise<ActionResult<Done>> {
  const res = await toResult(async () => {
    const actor = await requireArea("ljudje");
    return { historyId: historyId(await updateAccess(actor, payload)) };
  });
  if (res.ok) refresh();
  return res;
}

/** Odvzemi dostop → Potrdi. */
export async function removePerson(userId: string): Promise<ActionResult<Done>> {
  const res = await toResult(async () => {
    const actor = await requireArea("ljudje");
    return { historyId: historyId(await revokeAccess(actor, String(userId))) };
  });
  if (res.ok) refresh();
  return res;
}

/** Pošlji povabilo: creates the user, then e-mails the sign-in link. */
export async function invite(payload: PersonInvitePayload): Promise<ActionResult<Done & { mailed: boolean }>> {
  const res = await toResult(async () => {
    const actor = await requireArea("ljudje");
    const r = await invitePerson(actor, payload);
    return { historyId: historyId(r), mailed: r.mailed };
  });
  if (res.ok) refresh();
  return res;
}
