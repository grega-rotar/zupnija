/**
 * Confirming a proposal card runs the same engine action as the screens
 * (FR-12), so permissions, validation and approval are checked again there:
 * a forged cancel_mass from someone without "mase" is forbidden.
 */
import "server-only";
import { z } from "zod";
import { db as defaultDb, type Db } from "@/db";
import { perform, type PerformResult } from "@/lib/admin/engine";
import { UserError } from "@/lib/admin/errors";
import type { Actor } from "@/lib/admin/sections";
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
  })
  .default({});
export type ConfirmExtras = z.input<typeof confirmExtrasSchema>;

/** Engine action name and payload for a proposal; null for UI-only proposals. */
export function toAction(proposal: unknown, extras: unknown = {}): { name: string; payload: Record<string, unknown> } | null {
  const p = proposalSchema.safeParse(proposal);
  const x = confirmExtrasSchema.safeParse(extras);
  if (!p.success || !x.success) throw new UserError("Tega predloga ni mogoče shraniti.");
  const e = x.data;
  const opt = (s: string | undefined) => (s?.trim() ? s.trim() : undefined);
  switch (p.data.type) {
    case "add_intention":
      return {
        name: "intention.add",
        payload: { massId: p.data.massId, text: e.text ?? p.data.text, kind: e.kind ?? p.data.kind },
      };
    case "cancel_mass":
      return {
        name: "mass.cancel",
        payload: { massId: p.data.massId, reason: opt(e.reason ?? p.data.reason), intentionHandling: e.intentionHandling },
      };
    case "cancel_lesson":
      return {
        name: "lesson.cancel",
        payload: { groupId: p.data.groupId, date: p.data.date, message: opt(e.message ?? p.data.message) },
      };
    case "event": {
      const { type: _type, ...ev } = p.data;
      return { name: "event.save", payload: { ...ev, onFrontPage: false } };
    }
    case "open_upload":
      return null;
  }
}

export async function confirmProposal(actor: Actor, proposal: unknown, extras: unknown = {}, dbx: Db = defaultDb): Promise<PerformResult> {
  const action = toAction(proposal, extras);
  if (!action) throw new UserError("Nalaganje oznanil se odpre na zaslonu.");
  const payload = Object.fromEntries(Object.entries(action.payload).filter(([, v]) => v !== undefined));
  return perform(actor, action.name, payload, dbx);
}
