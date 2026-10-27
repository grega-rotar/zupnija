/**
 * Event actions (area "dogodki"): save (add or edit) and delete an event.
 * Helpers who need approval get a change request for event.save; only the
 * owner may delete (event.delete is never queued).
 */
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db as defaultDb, schema, type Db, type Tx } from "@/db";
import { defineAction, perform } from "@/lib/admin/engine";
import { ForbiddenError, UserError } from "@/lib/admin/errors";
import type { Actor } from "@/lib/admin/sections";

const e = schema.events;
const WHEN = "Izberite datum in uro.";

async function loadEvent(tx: Tx, id: number) {
  const [row] = await tx.select().from(e).where(eq(e.id, id));
  if (!row) throw new UserError("Tega dogodka ni več.");
  return row;
}

// ── event.save ──────────────────────────────────────────────────────────────
export const eventSaveSchema = z.object({
  id: z.number().int().optional(),
  title: z.string({ error: "Vpišite naslov." }).trim().min(1, "Vpišite naslov.").max(200, "Največ 200 znakov."),
  date: z.string({ error: WHEN }).regex(/^\d{4}-\d{2}-\d{2}$/, WHEN),
  time: z
    .string({ error: WHEN })
    .regex(/^\d{2}:\d{2}(:\d{2})?$/, WHEN)
    .transform((t) => t.slice(0, 5)),
  place: z.string({ error: "Izberite kraj." }).trim().min(1, "Izberite kraj.").max(200, "Največ 200 znakov."),
  description: z.string().trim().max(2000, "Največ 2000 znakov.").optional(),
  onFrontPage: z.boolean().optional(),
});
export type EventSavePayload = z.input<typeof eventSaveSchema>;

export const saveEventAction = defineAction({
  name: "event.save",
  area: "dogodki",
  approvable: true,
  schema: eventSaveSchema,
  label: (p) => (p.id ? `Sprememba dogodka: ${p.title}` : `Nov dogodek: ${p.title}`),
  check: async (p, tx) => {
    if (p.id) await loadEvent(tx, p.id);
  },
  apply: async (p, { requestedBy, track }) => {
    const values = {
      title: p.title,
      date: p.date,
      time: p.time,
      place: p.place,
      description: p.description ?? "",
      onFrontPage: p.onFrontPage ?? false,
    };
    return p.id ? track.update("events", p.id, values) : track.insert("events", { ...values, createdBy: requestedBy });
  },
  tags: ["events"],
});

// ── event.delete ────────────────────────────────────────────────────────────
/** The label is computed after apply, when the row is gone; remember it here. */
const deleted = new WeakMap<object, string>();

export const deleteEventAction = defineAction({
  name: "event.delete",
  area: "dogodki",
  approvable: false,
  schema: z.object({ id: z.number().int() }),
  label: async (p, tx) => deleted.get(p) ?? `Izbrisan dogodek: ${(await loadEvent(tx, p.id)).title}`,
  check: async (p, tx) => {
    await loadEvent(tx, p.id);
  },
  apply: async (p, { actor, track, tx }) => {
    if (!actor.isOwner) throw new ForbiddenError();
    const row = await loadEvent(tx, p.id);
    deleted.set(p, `Izbrisan dogodek: ${row.title}`);
    await track.delete("events", p.id);
  },
  tags: ["events"],
});

// ── Typed shortcuts for pages (same as perform(actor, name, payload)) ───────
export const saveEvent = (actor: Actor, payload: EventSavePayload, dbx: Db = defaultDb) =>
  perform(actor, "event.save", payload, dbx);
export const deleteEvent = (actor: Actor, id: number, dbx: Db = defaultDb) => perform(actor, "event.delete", { id }, dbx);
