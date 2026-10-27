/**
 * Generate concrete Masses from the regular schedule (FR-7).
 *
 * Idempotent through the unique key (date, time, church_id): existing rows are
 * never touched, so intentions, cancellations and edits survive. A generated
 * Mass that no longer matches the schedule is removed only while it is
 * untouched: source "schedule", never edited, still scheduled, no intentions
 * and no pending change request pointing at it, and not in the past.
 *
 * Days with a mass_day_overrides row that replaces the schedule get nothing.
 * These rows are not engine changes: no history, nothing to undo.
 */
import { and, eq, gte, inArray, isNull, lte, notExists, sql } from "drizzle-orm";
import type { Db, Tx } from "@/db";
import * as schema from "@/db/schema";
import { today } from "@/lib/clock";
import { dateRange } from "@/lib/dates";
import { hhmm } from "./format";

const key = (date: string, time: string, churchId: number) => `${date}|${hhmm(time)}|${churchId}`;

/** Make sure every scheduled Mass from `from` to `to` (inclusive) exists. Returns how many were created. */
export async function ensureMasses(dbx: Db | Tx, from: string, to: string): Promise<number> {
  const m = schema.masses;
  const [entries, overrides] = await Promise.all([
    dbx.select().from(schema.massScheduleEntries),
    dbx
      .select()
      .from(schema.massDayOverrides)
      .where(and(gte(schema.massDayOverrides.date, from), lte(schema.massDayOverrides.date, to))),
  ]);
  const skip = new Set(overrides.filter((o) => o.replacesSchedule).map((o) => o.date));

  const rows: (typeof m.$inferInsert)[] = [];
  for (const date of dateRange(from, to)) {
    if (skip.has(date)) continue;
    const wd = new Date(`${date}T12:00:00Z`).getUTCDay();
    for (const e of entries) {
      if (!e.weekdays.includes(wd)) continue;
      if (e.validFrom && e.validFrom > date) continue;
      if (e.validUntil && e.validUntil < date) continue;
      rows.push({ date, time: hhmm(e.time), churchId: e.churchId, type: e.type, note: e.note, source: "schedule" });
    }
  }

  const created = rows.length ? await dbx.insert(m).values(rows).onConflictDoNothing().returning({ id: m.id }) : [];

  // Untouched generated Masses the schedule no longer has.
  const start = from > today() ? from : today();
  if (start <= to) {
    const expected = new Set(rows.map((r) => key(r.date, r.time, r.churchId)));
    const i = schema.intentions;
    const cr = schema.changeRequests;
    const candidates = await dbx
      .select({ id: m.id, date: m.date, time: m.time, churchId: m.churchId })
      .from(m)
      .where(
        and(
          gte(m.date, start),
          lte(m.date, to),
          eq(m.source, "schedule"),
          isNull(m.editedAt),
          eq(m.status, "scheduled"),
          notExists(dbx.select({ x: sql`1` }).from(i).where(eq(i.massId, m.id))),
          notExists(
            dbx
              .select({ x: sql`1` })
              .from(cr)
              .where(and(eq(cr.status, "pending"), sql`(${cr.payload}->>'massId')::int = ${m.id}`)),
          ),
        ),
      );
    const stale = candidates.filter((c) => !expected.has(key(c.date, c.time, c.churchId))).map((c) => c.id);
    if (stale.length) await dbx.delete(m).where(inArray(m.id, stale));
  }

  return created.length;
}
