/**
 * Confirming a proposal card runs the same engine action as the screens
 * (FR-12), so permissions, validation and approval are checked again there:
 * a forged cancel_mass from someone without "mase" is forbidden, and so is a
 * forged invite_person or approve_change from anyone but the owner.
 */
import "server-only";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db as defaultDb, schema, type Db } from "@/db";
import { approve, perform, reject, type PerformResult } from "@/lib/admin/engine";
import { UserError } from "@/lib/admin/errors";
import { SECTIONS, type Actor } from "@/lib/admin/sections";
import { invitePerson, updateAccess } from "@/lib/ljudje/actions";
import { proposalSchema } from "./schema";

/** Choices made on the card before pressing Potrdi. */
export const confirmExtrasSchema = z
  .object({
    /** cancel_mass: what happens with the Mass's intentions. */
    intentionHandling: z.enum(["next", "keep"]).optional(),
    /** cancel_mass: the reason as edited on the card. */
    reason: z.string().max(500).optional(),
    /** cancel_lesson: the message to parents as edited on the card. */
    message: z.string().max(500).optional(),
    /** add_intention: the kind chosen on the card (answers kindIsGuess). */
    kind: z.enum(["deceased", "thanksgiving", "other"]).optional(),
    /** add_intention: the name as edited on the card. */
    text: z.string().max(200).optional(),
    /** invite_person / update_access: the sections as set on the card. */
    sections: z.array(z.enum(SECTIONS)).optional(),
    /** invite_person / update_access: "Spremembe potrdim jaz" as set on the card. */
    requiresApproval: z.boolean().optional(),
  })
  .default({});
export type ConfirmExtras = z.input<typeof confirmExtrasSchema>;

/**
 * What confirming does. `name` is an engine action, or one of the owner's
 * entry points that wrap the engine: "person.invite" (invitePerson, which
 * also e-mails), "change.approve" and "change.reject" (engine approve/reject).
 * null for UI-only proposals.
 */
export function toAction(proposal: unknown, extras: unknown = {}): { name: string; payload: Record<string, unknown> } | null {
  const p = proposalSchema.safeParse(proposal);
  const x = confirmExtrasSchema.safeParse(extras);
  if (!p.success || !x.success) throw new UserError("Tega predloga ni mogoče shraniti.");
  const e = x.data;
  const opt = (s: string | undefined) => (s?.trim() ? s.trim() : undefined);
  const d = p.data;
  switch (d.type) {
    case "add_intention":
      return { name: "intention.add", payload: { massId: d.massId, text: e.text ?? d.text, kind: e.kind ?? d.kind } };
    case "remove_intention":
      return { name: "intention.remove", payload: { intentionId: d.intentionId } };
    case "cancel_mass":
      return { name: "mass.cancel", payload: { massId: d.massId, reason: opt(e.reason ?? d.reason), intentionHandling: e.intentionHandling } };
    case "restore_mass":
      return { name: "mass.restore", payload: { massId: d.massId } };
    case "cancel_lesson":
      return { name: "lesson.cancel", payload: { groupId: d.groupId, date: d.date, message: opt(e.message ?? d.message) } };
    case "restore_lesson":
      return { name: "lesson.restore", payload: { groupId: d.groupId, date: d.date } };
    case "event":
      return { name: "event.save", payload: { title: d.title, date: d.date, time: d.time, place: d.place, description: d.description, onFrontPage: false } };
    case "edit_event":
      return { name: "event.save", payload: { id: d.id, title: d.title, date: d.date, time: d.time, place: d.place, description: d.description } };
    case "delete_event":
      return { name: "event.delete", payload: { id: d.id } };
    case "invite_person":
      return {
        name: "person.invite",
        payload: { name: d.name, email: d.email, title: opt(d.title), sections: e.sections ?? d.sections, requiresApproval: e.requiresApproval ?? d.requiresApproval },
      };
    case "update_access":
      return { name: "person.update", payload: { userId: d.userId, sections: e.sections ?? d.sections, requiresApproval: e.requiresApproval ?? d.requiresApproval } };
    case "approve_change":
      return { name: "change.approve", payload: { id: d.changeRequestId } };
    case "reject_change":
      return { name: "change.reject", payload: { id: d.changeRequestId } };
    case "open_upload":
      return null;
  }
}

/** What a confirmed card reports back: the engine result, "rejected" for Zavrni, and whether an invitation was mailed. */
export type ConfirmResult = (PerformResult | { status: "rejected" }) & { mailed?: boolean };

export async function confirmProposal(actor: Actor, proposal: unknown, extras: unknown = {}, dbx: Db = defaultDb): Promise<ConfirmResult> {
  const action = toAction(proposal, extras);
  if (!action) throw new UserError("Nalaganje oznanil se odpre na zaslonu.");
  const payload = Object.fromEntries(Object.entries(action.payload).filter(([, v]) => v !== undefined));
  switch (action.name) {
    case "person.invite":
      return invitePerson(actor, payload as Parameters<typeof invitePerson>[1], dbx);
    case "person.update":
      return updateAccess(actor, payload as Parameters<typeof updateAccess>[1], dbx);
    case "change.approve": {
      const { historyId } = await approve(actor, payload.id as number, dbx);
      return { status: "applied", historyId, result: null };
    }
    case "change.reject":
      await reject(actor, payload.id as number, dbx);
      return { status: "rejected" };
    case "event.save": {
      if (payload.id === undefined) break;
      // An edit names only what changes; everything else stays as the event is now.
      const e = schema.events;
      const [ev] = await dbx.select({ title: e.title, date: e.date, time: e.time, place: e.place, description: e.description, onFrontPage: e.onFrontPage }).from(e).where(eq(e.id, payload.id as number));
      if (!ev) throw new UserError("Tega dogodka ni več.");
      const current = { title: ev.title, date: ev.date, time: ev.time.slice(0, 5), place: ev.place, description: ev.description, onFrontPage: ev.onFrontPage };
      return perform(actor, "event.save", { ...current, ...payload }, dbx);
    }
  }
  return perform(actor, action.name, payload, dbx);
}
