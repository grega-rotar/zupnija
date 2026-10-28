/**
 * Public Masses and intentions, from Postgres (the editor's data), in the
 * shapes the site's components already use (`Mass` / `MassDay` from
 * src/lib/masses.ts).
 *
 * - Only published data: pending change requests (a helper's intention or
 *   cancellation waiting for the priest) are never read here.
 * - A cancelled Mass stays in the list with status "cancelled" and its reason
 *   as `statusNote`. Intentions kept on a cancelled Mass are not shown (FR-8).
 * - Missing Masses of the regular schedule are generated with the editor's
 *   `ensureMasses`, within a window around today, so the public site and the
 *   editor list the same rows. Weeks far outside it show only stored rows.
 */
import "server-only";
import { and, asc, eq, gte, inArray, lte } from "drizzle-orm";
import { db, schema } from "@/db";
import { today, nowTime, weekStart } from "@/lib/clock";
import { addDays, dateRange, type IsoDate } from "@/lib/dates";
import type { Mass, MassDay } from "@/lib/masses";
import { ensureMasses } from "@/lib/mase/ensure";
import { FEASTS } from "@/lib/mase/format";
import { cached, hhmm } from "./cache";

/** Masses are generated from the schedule only between these offsets from today (days). */
const ENSURE_BACK = 14;
const ENSURE_AHEAD = 200;

const m = schema.masses;
const c = schema.churches;
const i = schema.intentions;

async function loadMassDays(from: IsoDate, to: IsoDate): Promise<MassDay[]> {
  if (from > to) return [];
  const t = today();
  const lo = from > addDays(t, -ENSURE_BACK) ? from : addDays(t, -ENSURE_BACK);
  const hi = to < addDays(t, ENSURE_AHEAD) ? to : addDays(t, ENSURE_AHEAD);
  if (lo <= hi) await ensureMasses(db, lo, hi);

  const [rows, overrides] = await Promise.all([
    db
      .select({ mass: m, church: { slug: c.slug, name: c.name, shortName: c.shortName } })
      .from(m)
      .innerJoin(c, eq(c.id, m.churchId))
      .where(and(gte(m.date, from), lte(m.date, to)))
      .orderBy(asc(m.date), asc(m.time), asc(c.position)),
    db
      .select()
      .from(schema.massDayOverrides)
      .where(and(gte(schema.massDayOverrides.date, from), lte(schema.massDayOverrides.date, to))),
  ]);
  const ids = rows.filter((r) => r.mass.status === "scheduled").map((r) => r.mass.id);
  const ints = ids.length ? await db.select().from(i).where(inArray(i.massId, ids)).orderBy(asc(i.position), asc(i.id)) : [];

  const masses = rows.map(({ mass, church }): Mass => ({
    key: `m${mass.id}`,
    time: hhmm(mass.time),
    church: { _id: `church-${church.slug}`, name: church.name, shortName: church.shortName, slug: church.slug },
    type: mass.type,
    status: mass.status,
    statusNote: mass.status === "cancelled" ? mass.cancelReason || null : null,
    note: mass.note,
    celebrant: null,
    intentions: ints.filter((x) => x.massId === mass.id).map((x) => ({ _key: `i${x.id}`, kind: x.kind, text: x.text })),
    recurring: mass.source === "schedule",
  }));
  const labels = new Map(overrides.map((o) => [o.date, o.label]));

  return dateRange(from, to).map((date) => {
    const list = masses.filter((_, n) => rows[n].mass.date === date);
    return {
      date,
      liturgicalTitle: labels.get(date) || FEASTS[date] || null,
      note: null,
      masses: list,
      // Drives "nameni še niso vpisani" on /masni-nameni.
      hasExplicitDay: list.some((x) => x.intentions.length > 0),
    };
  });
}

/** Masses for every day in [from, to] (inclusive), published data only. */
export const getMassDays = cached(loadMassDays, "massDays", ["masses"]);

/** Today + next `days` days, plus the current time for "what is still ahead". */
export async function getUpcomingMasses(days = 7) {
  const from = today();
  const list = await getMassDays(from, addDays(from, days));
  return { today: from, time: nowTime(), days: list };
}

/** The week (Sunday → Saturday) that contains `date`, as on /masni-nameni and in the editor. */
export async function getMassWeek(date: IsoDate) {
  const from = weekStart(date);
  const to = addDays(from, 6);
  return { from, to, days: await getMassDays(from, to) };
}

/** The days of getMassWeek: the same Masses and published intentions as the editor's week. */
export async function getWeekMasses(date: IsoDate): Promise<MassDay[]> {
  return (await getMassWeek(date)).days;
}
