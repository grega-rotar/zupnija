/**
 * "bulletin.publish": the checked draft becomes intentions on the week's
 * Masses plus the bulletin's notices. A helper's publish becomes a change
 * request (service.ts publishBulletin then marks the bulletin "pending").
 *
 * Payload: { bulletinId, resolutions: { [itemId]: chosen or typed value for
 * that item's flag }, notices: the (possibly edited) announcements }.
 */
import { and, asc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { schema, type Tx } from "@/db";
import { defineAction } from "@/lib/admin/engine";
import { UserError } from "@/lib/admin/errors";
import { now } from "@/lib/clock";
import { addDays, formatWeekSpan } from "@/lib/dates";
import { ensureMasses } from "@/lib/mase/ensure";
import { readableDraftSchema, type BulletinItem, type ReadableDraft } from "./types";

export const OPEN_FLAGS = "Najprej preverite označena mesta.";
export const ALREADY_PUBLISHED = "Oznanila za ta teden so že objavljena.";

export const publishSchema = z.object({
  bulletinId: z.number().int().positive(),
  resolutions: z.record(z.string(), z.string().trim()).default({}),
  notices: z.array(z.string().trim()).transform((ns) => ns.filter(Boolean)),
});
export type PublishPayload = z.input<typeof publishSchema>;

async function loadBulletin(tx: Tx, id: number) {
  const [b] = await tx.select().from(schema.bulletins).where(eq(schema.bulletins.id, id));
  if (!b) throw new UserError("Teh oznanil ni več.");
  return b;
}

function readableDraft(draft: unknown): ReadableDraft {
  const r = readableDraftSchema.safeParse(draft);
  if (!r.success) throw new UserError("Ta oznanila nimajo osnutka za objavo.");
  return r.data;
}

const toTime = (v: string) => {
  const m = v.match(/^(\d{1,2})[:.](\d{2})/);
  if (!m) throw new UserError(OPEN_FLAGS);
  return `${m[1].padStart(2, "0")}:${m[2]}`;
};

/** The item as it will be published, with its flag's resolution applied. */
export function resolveItem(item: BulletinItem, resolutions: Record<string, string>): BulletinItem {
  const v = resolutions[item.id];
  if (!item.flag) return item;
  if (!v) throw new UserError(OPEN_FLAGS);
  switch (item.flag.field) {
    case "text":
      return { ...item, text: v.slice(0, 200) };
    case "time":
      return { ...item, time: toTime(v) };
    case "date":
      if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) throw new UserError(OPEN_FLAGS);
      return { ...item, date: v };
    case "church":
      return { ...item, churchSlug: v };
  }
}

type P = z.output<typeof publishSchema>;

export const publishBulletinAction = defineAction<P>({
  name: "bulletin.publish",
  area: "oznanila",
  approvable: true,
  schema: publishSchema as unknown as z.ZodType<P>,
  label: async (p, tx) => {
    const b = await loadBulletin(tx, p.bulletinId);
    return `Objava oznanil ${formatWeekSpan(b.weekStart, addDays(b.weekStart, 6))}`;
  },
  check: async (p, tx) => {
    const b = await loadBulletin(tx, p.bulletinId);
    if (b.status === "published") throw new UserError(ALREADY_PUBLISHED);
    if (b.status !== "draft" && b.status !== "pending") throw new UserError("Ta oznanila nimajo osnutka za objavo.");
    const draft = readableDraft(b.draft);
    draft.items.forEach((it) => resolveItem(it, p.resolutions));
  },
  apply: async (p, { actor, requestedBy, track, tx }) => {
    const b = await loadBulletin(tx, p.bulletinId);
    const draft = readableDraft(b.draft);
    const items = draft.items.map((it) => resolveItem(it, p.resolutions));
    const weekEnd = addDays(b.weekStart, 6);
    await ensureMasses(tx, b.weekStart, weekEnd);

    const churches = await tx.select().from(schema.churches);
    const churchId = new Map(churches.map((c) => [c.slug, c.id]));
    const m = schema.masses;
    const nextPos = new Map<number, number>();

    let intentions = 0;
    for (const it of items) {
      const cid = churchId.get(it.churchSlug);
      if (cid == null) throw new UserError("Neznana cerkev v osnutku. Popravite jo pred objavo.");
      const onDay = await tx.select().from(m).where(and(eq(m.date, it.date), eq(m.churchId, cid))).orderBy(asc(m.time));
      let mass = onDay.find((x) => x.time.slice(0, 5) === it.time);
      if (!mass && it.flag?.field === "time") {
        // The priest confirmed a time the schedule doesn't have: move that day's Mass.
        const scheduled = onDay.find((x) => x.status === "scheduled");
        if (scheduled) mass = await track.update("masses", scheduled.id, { time: it.time, editedAt: now() });
      }
      if (!mass) mass = await track.insert("masses", { date: it.date, time: it.time, churchId: cid, source: "manual", editedAt: now() });

      if (!nextPos.has(mass.id)) {
        const [{ n }] = await tx.select({ n: sql<number>`count(*)::int` }).from(schema.intentions).where(eq(schema.intentions.massId, mass.id));
        nextPos.set(mass.id, n);
      }
      const position = nextPos.get(mass.id)!;
      nextPos.set(mass.id, position + 1);
      await track.insert("intentions", { massId: mass.id, kind: it.kind, text: it.text, position, createdBy: requestedBy });
      intentions++;
    }

    for (const [position, text] of p.notices.entries()) {
      await track.insert("bulletin_notices", { bulletinId: b.id, position, text });
    }
    await track.update("bulletins", b.id, { status: "published", publishedAt: now(), publishedBy: actor.id, error: null });
    return { intentions, notices: p.notices.length };
  },
  tags: ["bulletins", "masses"],
});
