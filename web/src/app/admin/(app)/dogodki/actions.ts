"use server";

import "@/lib/admin/next";
import { eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { db, schema } from "@/db";
import { approve, perform, reject } from "@/lib/admin/registry";
import { toResult, UserError, type ActionResult } from "@/lib/admin/errors";
import { requireArea } from "@/lib/admin/session";
import { today } from "@/lib/clock";
import { eventSaveSchema, type EventSavePayload } from "@/lib/dogodki/actions";

export type EventField = "title" | "date" | "time" | "place" | "description";
export type EventSaved = { status: "applied"; historyId: number } | { status: "pending" };
/** An ActionResult, or a validation message that belongs next to one field. */
export type EventSaveResult = ActionResult<EventSaved> | { ok: false; error: string; field: EventField };

const FIELDS: readonly string[] = ["title", "date", "time", "place", "description"];

/** The proposal this panel was opened on, still pending (owner only). */
async function pendingProposal(id: number | undefined) {
  if (!id) return null;
  const [cr] = await db.select().from(schema.changeRequests).where(eq(schema.changeRequests.id, id));
  return cr && cr.status === "pending" && cr.action === "event.save" ? cr : null;
}

type Saved = ReturnType<typeof eventSaveSchema.parse>;
const norm = (p: Saved) => [p.id ?? null, p.title, p.date, p.time, p.place, p.description ?? "", p.onFrontPage ?? false];
const same = (a: Saved, b: Saved) => JSON.stringify(norm(a)) === JSON.stringify(norm(b));

/**
 * "Shrani" / "Dodaj dogodek" / "Pošlji v potrditev" in the event panel.
 * When the owner saves a helper's pending proposal, the proposal is settled
 * with it: unchanged it is approved as is, edited the owner's version is
 * published and the proposal set aside.
 */
export async function saveEventFromPanel(input: EventSavePayload & { proposal?: number }): Promise<EventSaveResult> {
  const { proposal, ...payload } = input;
  const parsed = eventSaveSchema.safeParse(payload);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const field = String(issue?.path[0] ?? "");
    return FIELDS.includes(field)
      ? { ok: false, error: issue.message, field: field as EventField }
      : { ok: false, error: issue?.message ?? "Neveljavni podatki." };
  }
  if (parsed.data.date < today()) return { ok: false, error: "Ta datum je že mimo.", field: "date" };

  const res = await toResult(async (): Promise<EventSaved> => {
    const actor = await requireArea("dogodki");
    const cr = actor.isOwner ? await pendingProposal(proposal) : null;
    if (cr) {
      const before = eventSaveSchema.safeParse(cr.payload);
      if (before.success && same(before.data, parsed.data)) return { status: "applied", ...(await approve(actor, cr.id)) };
    }
    const out = await perform(actor, "event.save", parsed.data);
    if (cr) await reject(actor, cr.id);
    if (out.status === "pending") return { status: "pending" };
    return { status: "applied", historyId: out.historyId };
  });
  if (res.ok) refresh();
  return res;
}

/**
 * "Izbriši" (owner only). A proposal for a new event has nothing to delete
 * yet, so it is turned down instead (and there is nothing to undo).
 */
export async function deleteEventFromPanel(input: { id: number | null; proposal?: number }): Promise<ActionResult<{ historyId: number | null }>> {
  const res = await toResult(async () => {
    const actor = await requireArea("dogodki");
    if (!actor.isOwner) throw new UserError("Dogodek lahko izbriše samo župnik.");
    const cr = await pendingProposal(input.proposal);
    let historyId: number | null = null;
    if (input.id) {
      const out = await perform(actor, "event.delete", { id: input.id });
      if (out.status === "applied") historyId = out.historyId;
    }
    if (cr) await reject(actor, cr.id);
    return { historyId };
  });
  if (res.ok) refresh();
  return res;
}
