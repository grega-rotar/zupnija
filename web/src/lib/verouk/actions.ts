/**
 * Verouk actions (area "verouk"): cancel one week's lesson of a group with a
 * message for parents, or put it back on the schedule.
 */
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db as defaultDb, schema, type Db, type Tx } from "@/db";
import { defineAction, perform } from "@/lib/admin/engine";
import { UserError } from "@/lib/admin/errors";
import type { Actor } from "@/lib/admin/sections";

const g = schema.catechesisGroups;
const c = schema.catechesisCancellations;
const DATE = z.string({ error: "Izberite datum." }).regex(/^\d{4}-\d{2}-\d{2}$/, "Izberite datum.");

async function loadGroup(tx: Tx, id: number) {
  const [row] = await tx.select().from(g).where(eq(g.id, id));
  if (!row) throw new UserError("Te skupine ni več.");
  return row;
}

async function findCancellation(tx: Tx, groupId: number, date: string) {
  const [row] = await tx.select().from(c).where(and(eq(c.groupId, groupId), eq(c.date, date)));
  return row ?? null;
}

const weekday = (iso: string) => new Date(`${iso}T12:00:00Z`).getUTCDay();

// ── lesson.cancel ───────────────────────────────────────────────────────────
export const lessonCancelSchema = z.object({
  groupId: z.number().int(),
  date: DATE,
  message: z.string().trim().max(500, "Največ 500 znakov.").optional(),
});
export type LessonCancelPayload = z.input<typeof lessonCancelSchema>;

export const cancelLessonAction = defineAction({
  name: "lesson.cancel",
  area: "verouk",
  approvable: true,
  schema: lessonCancelSchema,
  label: async (p, tx) => `Verouk ${(await loadGroup(tx, p.groupId)).name} odpade`,
  check: async (p, tx) => {
    const group = await loadGroup(tx, p.groupId);
    if (weekday(p.date) !== group.weekday) throw new UserError("Ta dan te skupine ni verouka.");
    if (await findCancellation(tx, p.groupId, p.date)) throw new UserError("Ta ura verouka že odpade.");
  },
  apply: (p, { track }) =>
    track.insert("catechesis_cancellations", { groupId: p.groupId, date: p.date, message: p.message ?? "" }),
  tags: ["verouk"],
});

// ── lesson.restore ──────────────────────────────────────────────────────────
export const lessonRestoreSchema = z.object({ groupId: z.number().int(), date: DATE });
export type LessonRestorePayload = z.input<typeof lessonRestoreSchema>;

export const restoreLessonAction = defineAction({
  name: "lesson.restore",
  area: "verouk",
  approvable: true,
  schema: lessonRestoreSchema,
  label: async (p, tx) => `Verouk ${(await loadGroup(tx, p.groupId)).name} spet na urniku`,
  check: async (p, tx) => {
    await loadGroup(tx, p.groupId);
    if (!(await findCancellation(tx, p.groupId, p.date))) throw new UserError("Ta ura verouka ni odpovedana.");
  },
  apply: async (p, { track, tx }) => {
    const row = await findCancellation(tx, p.groupId, p.date);
    if (!row) throw new UserError("Ta ura verouka ni odpovedana.");
    await track.delete("catechesis_cancellations", row.id);
  },
  tags: ["verouk"],
});

// ── Typed shortcuts for pages (same as perform(actor, name, payload)) ───────
export const cancelLesson = (actor: Actor, payload: LessonCancelPayload, dbx: Db = defaultDb) =>
  perform(actor, "lesson.cancel", payload, dbx);
export const restoreLesson = (actor: Actor, payload: LessonRestorePayload, dbx: Db = defaultDb) =>
  perform(actor, "lesson.restore", payload, dbx);
