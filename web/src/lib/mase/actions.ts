/**
 * Mass and intention actions (area "mase"): add or remove an intention, cancel
 * or restore a Mass. All writes go through the Tracker (see admin/engine.ts).
 *
 * Cancelling or restoring sets masses.edited_at, so ensureMasses never
 * regenerates that Mass (FR-7). Intentions protect a Mass on their own.
 */
import { and, asc, eq, gt, max, ne, sql } from "drizzle-orm";
import { z } from "zod";
import { schema, type Tx } from "@/db";
import { defineAction } from "@/lib/admin/engine";
import { UserError } from "@/lib/admin/errors";
import { now } from "@/lib/clock";
import { addDays } from "@/lib/dates";
import { ensureMasses } from "./ensure";
import { dayLabel, kindPrefix, timeLabel } from "./format";

const m = schema.masses;
const i = schema.intentions;

async function loadMass(tx: Tx, massId: number) {
  const [row] = await tx
    .select({ mass: m, church: schema.churches.shortName })
    .from(m)
    .innerJoin(schema.churches, eq(schema.churches.id, m.churchId))
    .where(eq(m.id, massId));
  if (!row) throw new UserError("Te maše ni več.");
  return row;
}

/** "sreda, 28. oktober, 18.30, Marijina cerkev" */
async function massWhere(tx: Tx, massId: number): Promise<string> {
  const { mass, church } = await loadMass(tx, massId);
  return `${dayLabel(mass.date)}, ${timeLabel(mass.time)}, ${church}`;
}

const intentionsOf = (tx: Tx, massId: number) =>
  tx.select().from(i).where(eq(i.massId, massId)).orderBy(asc(i.position), asc(i.id));

async function nextPosition(tx: Tx, massId: number): Promise<number> {
  const [r] = await tx.select({ p: max(i.position) }).from(i).where(eq(i.massId, massId));
  return r?.p == null ? 0 : r.p + 1;
}

// ── intention.add ───────────────────────────────────────────────────────────
export const addIntention = defineAction({
  name: "intention.add",
  area: "mase",
  approvable: true,
  schema: z.object({
    massId: z.number().int(),
    text: z
      .string({ error: "Vpišite, za koga je namen." })
      .trim()
      .min(1, "Vpišite, za koga je namen.")
      .max(200, "Največ 200 znakov."),
    kind: z.enum(["deceased", "thanksgiving", "other"]),
  }),
  label: (p) => `Nov namen ${kindPrefix(p.kind)} ${p.text}`,
  check: async (p, tx) => {
    const { mass } = await loadMass(tx, p.massId);
    if (mass.status === "cancelled") throw new UserError("Maša je bila medtem odpovedana.");
  },
  apply: async (p, { track, tx, requestedBy }) =>
    track.insert("intentions", {
      massId: p.massId,
      kind: p.kind,
      text: p.text,
      position: await nextPosition(tx, p.massId),
      createdBy: requestedBy,
    }),
  tags: ["masses"],
});

// ── intention.remove ────────────────────────────────────────────────────────
/** The label is computed after apply, when the row is gone; remember it here. */
const removed = new WeakMap<object, string>();

async function loadIntention(tx: Tx, id: number) {
  const [row] = await tx.select().from(i).where(eq(i.id, id));
  if (!row) throw new UserError("Tega namena ni več.");
  return row;
}

export const removeIntention = defineAction({
  name: "intention.remove",
  area: "mase",
  approvable: true,
  schema: z.object({ intentionId: z.number().int() }),
  label: async (p, tx) => {
    const cached = removed.get(p);
    if (cached) return cached;
    const row = await loadIntention(tx, p.intentionId);
    return `Odstranjen namen ${kindPrefix(row.kind)} ${row.text}`;
  },
  check: async (p, tx) => {
    await loadIntention(tx, p.intentionId);
  },
  apply: async (p, { track, tx }) => {
    const row = await loadIntention(tx, p.intentionId);
    removed.set(p, `Odstranjen namen ${kindPrefix(row.kind)} ${row.text}`);
    await track.delete("intentions", p.intentionId);
  },
  tags: ["masses"],
});

// ── mass.cancel ─────────────────────────────────────────────────────────────
/** The next Mass after this one (by date and time) that still takes place. */
async function nextMass(tx: Tx, mass: typeof m.$inferSelect) {
  await ensureMasses(tx, mass.date, addDays(mass.date, 14));
  const [next] = await tx
    .select()
    .from(m)
    .where(
      and(
        eq(m.status, "scheduled"),
        ne(m.id, mass.id),
        gt(sql`(${m.date}, ${m.time})`, sql`(${mass.date}::date, ${mass.time}::time)`),
      ),
    )
    .orderBy(asc(m.date), asc(m.time))
    .limit(1);
  return next ?? null;
}

export const cancelMass = defineAction({
  name: "mass.cancel",
  area: "mase",
  approvable: true,
  schema: z.object({
    massId: z.number().int(),
    reason: z.string().trim().max(200, "Največ 200 znakov.").optional(),
    intentionHandling: z.enum(["next", "keep"]).optional(),
  }),
  label: async (p, tx) => `Odpoved maše: ${await massWhere(tx, p.massId)}`,
  check: async (p, tx) => {
    const { mass } = await loadMass(tx, p.massId);
    if (mass.status === "cancelled") throw new UserError("Ta maša je že odpovedana.");
    if (!p.intentionHandling && (await intentionsOf(tx, p.massId)).length)
      throw new UserError("Izberite, kaj naj bo z namenom.");
  },
  apply: async (p, { track, tx }) => {
    const { mass } = await loadMass(tx, p.massId);
    if (p.intentionHandling === "next") {
      const list = await intentionsOf(tx, p.massId);
      if (list.length) {
        const next = await nextMass(tx, mass);
        if (!next) throw new UserError("Ni naslednje maše, na katero bi prestavili namen.");
        let pos = await nextPosition(tx, next.id);
        for (const it of list) {
          await track.update("intentions", it.id, { massId: next.id, movedFromMassId: mass.id, position: pos++ });
        }
      }
    }
    return track.update("masses", p.massId, { status: "cancelled", cancelReason: p.reason || null, editedAt: now() });
  },
  tags: ["masses"],
});

// ── mass.restore ────────────────────────────────────────────────────────────
export const restoreMass = defineAction({
  name: "mass.restore",
  area: "mase",
  approvable: true,
  schema: z.object({ massId: z.number().int() }),
  label: async (p, tx) => {
    const { mass, church } = await loadMass(tx, p.massId);
    return `Maša spet na urniku: ${dayLabel(mass.date)}, ${timeLabel(mass.time)}, ${church}`;
  },
  check: async (p, tx) => {
    const { mass } = await loadMass(tx, p.massId);
    if (mass.status !== "cancelled") throw new UserError("Ta maša ni odpovedana.");
  },
  // Moved intentions stay where they were moved (US-006).
  apply: (p, { track }) => track.update("masses", p.massId, { status: "scheduled", cancelReason: null, editedAt: now() }),
  tags: ["masses"],
});
