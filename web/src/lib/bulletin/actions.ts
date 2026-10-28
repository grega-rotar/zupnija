/**
 * "bulletin.publish": the checked draft becomes intentions on the period's
 * Masses, the bulletin's notices, calendar days and events. A helper's
 * publish becomes a change request (service.ts publishBulletin then marks the
 * bulletin "pending").
 *
 * Payload: { bulletinId, resolutions: { [intentionOrEventId]: chosen or typed
 * value for that flag } }. Edits (notices, event include toggles, added or
 * removed intentions, article, prayer intention) are saved into the draft
 * first with saveDraftForLater.
 *
 * Deduplicating, so publishing a period that already has some of its
 * intentions (the Sanity import, an earlier weekly bulletin) adds only what
 * is new: an intention is skipped when the same Mass already has the same
 * text (intentions.ts intentionKey); an event when one with the same title
 * and date exists. calendar_days of the period are overwritten. Past dates
 * are allowed: an October booklet uploaded late still fills October.
 */
import { and, asc, eq, gte, lte, sql } from "drizzle-orm";
import { z } from "zod";
import { schema, type Tx } from "@/db";
import { defineAction } from "@/lib/admin/engine";
import { UserError } from "@/lib/admin/errors";
import { now } from "@/lib/clock";
import { ensureMasses } from "@/lib/mase/ensure";
import { intentionKey } from "./intentions";
import { allIntentions, periodLabel, readableDraftSchema, type DatedIntention, type DraftEvent, type ReadableDraft } from "./types";

export const OPEN_FLAGS = "Najprej preverite označena mesta.";
export const ALREADY_PUBLISHED = "Ta oznanila so že objavljena.";

export const publishSchema = z.object({
  bulletinId: z.number().int().positive(),
  resolutions: z.record(z.string(), z.string().trim()).default({}),
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
const toDate = (v: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) throw new UserError(OPEN_FLAGS);
  return v;
};

/** The intention as it will be published, with its flag's resolution applied. */
export function resolveIntention(item: DatedIntention, resolutions: Record<string, string>): DatedIntention {
  const v = resolutions[item.id];
  if (!item.flag) return item;
  if (!v) throw new UserError(OPEN_FLAGS);
  switch (item.flag.field) {
    case "text":
      return { ...item, text: v.slice(0, 200) };
    case "time":
      return { ...item, time: toTime(v) };
    case "date":
      return { ...item, date: toDate(v) };
    case "church":
      return { ...item, churchSlug: v };
    case "event":
      return item;
  }
}

/**
 * The event as it will be published. Flag fields on events: "time" → time,
 * "date" → date, "text" → title, "event" / "church" → place. An unticked
 * event needs no resolution.
 */
export function resolveEvent(ev: DraftEvent, resolutions: Record<string, string>): DraftEvent {
  if (!ev.include || !ev.flag) return ev;
  const v = resolutions[ev.id];
  if (!v) throw new UserError(OPEN_FLAGS);
  switch (ev.flag.field) {
    case "time":
      return { ...ev, time: toTime(v) };
    case "date":
      return { ...ev, date: toDate(v) };
    case "text":
      return { ...ev, title: v.slice(0, 200) };
    case "event":
    case "church":
      return { ...ev, place: v };
  }
}

type P = z.output<typeof publishSchema>;

/** "Objava oznanil za oktober 2026", "Objava oznanil za 1.–7. november 2026". */
const label = (b: { periodStart: string; periodEnd: string }) => `Objava oznanil za ${periodLabel(b.periodStart, b.periodEnd)}`;

export const publishBulletinAction = defineAction<P>({
  name: "bulletin.publish",
  area: "oznanila",
  approvable: true,
  schema: publishSchema as unknown as z.ZodType<P>,
  label: async (p, tx) => label(await loadBulletin(tx, p.bulletinId)),
  check: async (p, tx) => {
    const b = await loadBulletin(tx, p.bulletinId);
    if (b.status === "published") throw new UserError(ALREADY_PUBLISHED);
    if (b.status !== "draft" && b.status !== "pending") throw new UserError("Ta oznanila nimajo osnutka za objavo.");
    const draft = readableDraft(b.draft);
    allIntentions(draft).forEach((it) => resolveIntention(it, p.resolutions));
    draft.events.forEach((ev) => resolveEvent(ev, p.resolutions));
  },
  apply: async (p, { actor, requestedBy, track, tx }) => {
    const b = await loadBulletin(tx, p.bulletinId);
    const draft = readableDraft(b.draft);
    const items = allIntentions(draft).map((it) => resolveIntention(it, p.resolutions));
    // The period, widened to any (flagged, confirmed) day outside it.
    const dates = [draft.period.start, draft.period.end, ...items.map((it) => it.date)].sort();
    const start = dates[0], end = dates[dates.length - 1];
    await ensureMasses(tx, start, end);

    const churches = await tx.select().from(schema.churches);
    const churchId = new Map(churches.map((c) => [c.slug, c.id]));
    const m = schema.masses, i = schema.intentions;

    // What the period's Masses already hold, for dedupe and positions.
    const existing = await tx
      .select({ massId: i.massId, text: i.text })
      .from(i)
      .innerJoin(m, eq(m.id, i.massId))
      .where(and(gte(m.date, start), lte(m.date, end)));
    const have = new Set(existing.map((x) => `${x.massId}|${intentionKey(x.text)}`));
    const nextPos = new Map<number, number>();
    for (const x of existing) nextPos.set(x.massId, (nextPos.get(x.massId) ?? 0) + 1);

    let intentions = 0, skipped = 0;
    for (const it of items) {
      const cid = churchId.get(it.churchSlug);
      if (cid == null) throw new UserError("Neznana cerkev v osnutku. Popravite jo pred objavo.");
      const onDay = await tx.select().from(m).where(and(eq(m.date, it.date), eq(m.churchId, cid))).orderBy(asc(m.time));
      let mass = onDay.find((x) => x.time.slice(0, 5) === it.time);
      if (!mass && it.flag?.field === "time") {
        // The priest confirmed a time the schedule doesn't have: move that day's untouched Mass.
        const scheduled = onDay.find((x) => x.status === "scheduled" && !nextPos.get(x.id));
        if (scheduled) mass = await track.update("masses", scheduled.id, { time: it.time, editedAt: now() });
      }
      if (!mass) mass = await track.insert("masses", { date: it.date, time: it.time, churchId: cid, source: "manual", editedAt: now() });

      const key = `${mass.id}|${intentionKey(it.text)}`;
      if (have.has(key)) {
        skipped++;
        continue;
      }
      have.add(key);
      const position = nextPos.get(mass.id) ?? 0;
      nextPos.set(mass.id, position + 1);
      await track.insert("intentions", { massId: mass.id, kind: it.kind, text: it.text, position, createdBy: requestedBy });
      intentions++;
    }

    // Notices replace any earlier ones of this bulletin (none, normally).
    const n = schema.bulletinNotices;
    for (const old of await tx.select().from(n).where(eq(n.bulletinId, b.id))) await track.delete("bulletin_notices", old.id);
    for (const [position, notice] of draft.notices.entries()) {
      await track.insert("bulletin_notices", { bulletinId: b.id, position, text: notice.text });
    }

    // Calendar days of the period: overwritten by this bulletin.
    let days = 0;
    for (const d of draft.days) {
      if (!d.title) continue;
      const values = { title: d.title, sundayName: d.sundayName ?? null, gospel: d.gospel ?? null, tags: d.tags, bulletinId: b.id };
      const [old] = await tx.select().from(schema.calendarDays).where(eq(schema.calendarDays.date, d.date));
      if (old) await track.update("calendar_days", d.date, values);
      else await track.insert("calendar_days", { date: d.date, ...values });
      days++;
    }

    // Events the priest kept, unless the same title and date exist already.
    const e = schema.events;
    let events = 0;
    for (const ev of draft.events.map((x) => resolveEvent(x, p.resolutions))) {
      if (!ev.include) continue;
      const [dupe] = await tx
        .select({ id: e.id })
        .from(e)
        .where(and(eq(e.date, ev.date), sql`lower(${e.title}) = lower(${ev.title})`))
        .limit(1);
      if (dupe) continue;
      await track.insert("events", {
        title: ev.title,
        date: ev.date,
        time: ev.time ?? "00:00",
        place: ev.place ?? "",
        description: ev.description ?? "",
        sourceBulletinId: b.id,
        createdBy: requestedBy,
      });
      events++;
    }

    await track.update("bulletins", b.id, {
      status: "published",
      publishedAt: now(),
      publishedBy: actor.id,
      error: null,
      title: draft.period.title,
      issue: draft.period.issue ?? null,
      article: draft.article ?? null,
      prayerIntention: draft.prayerIntention ?? null,
    });
    return { intentions, skipped, notices: draft.notices.length, days, events };
  },
  tags: ["bulletins", "masses", "events"],
});
