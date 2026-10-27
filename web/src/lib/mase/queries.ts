/**
 * Read side of "Maše in nameni": the week view, one Mass, the next Mass and
 * the lists Domov and the "Nov namen" picker need.
 *
 * Pending items are change_requests rows (intention.add, mass.cancel) shown
 * next to the Mass they point at, with the helper's name.
 */
import { and, asc, eq, gt, gte, inArray, lte, or, sql } from "drizzle-orm";
import { db as defaultDb, schema, type Db } from "@/db";
import { today, nowTime, weekStart as mondayOf } from "@/lib/clock";
import { addDays, dateRange } from "@/lib/dates";
import { ensureMasses } from "./ensure";
import { dayLabel, FEASTS, hhmm, weekdayLabel, type IntentionKind } from "./format";

export type MassIntention = {
  id: number;
  kind: IntentionKind;
  text: string;
  position: number;
  movedFromMassId: number | null;
};

export type PendingIntention = {
  changeRequestId: number;
  kind: IntentionKind;
  text: string;
  createdBy: string;
  createdByName: string;
  createdAt: Date;
};

export type PendingCancel = {
  changeRequestId: number;
  reason: string | null;
  intentionHandling: "next" | "keep" | null;
  createdBy: string;
  createdByName: string;
  createdAt: Date;
};

export type MassView = {
  id: number;
  date: string;
  /** "18:30" */
  time: string;
  churchId: number;
  church: string;
  type: (typeof schema.massTypeEnum.enumValues)[number];
  status: "scheduled" | "cancelled";
  cancelReason: string | null;
  note: string | null;
  intentions: MassIntention[];
  pending: PendingIntention[];
  pendingCancel: PendingCancel | null;
};

export type WeekDay = {
  date: string;
  /** "sreda" */
  weekday: string;
  /** "sreda, 28. oktober" */
  label: string;
  feast: string | null;
  masses: MassView[];
};

export type Week = {
  weekStart: string;
  weekEnd: string;
  days: WeekDay[];
  /** No published and no pending intention in the whole week. */
  isEmpty: boolean;
  counts: { masses: number; cancelled: number; intentions: number; pending: number; withoutIntention: number };
};

const m = schema.masses;
const i = schema.intentions;
const cr = schema.changeRequests;

type MassRow = { mass: typeof m.$inferSelect; church: string };

const massSelect = (dbx: Db) =>
  dbx
    .select({ mass: m, church: schema.churches.shortName })
    .from(m)
    .innerJoin(schema.churches, eq(schema.churches.id, m.churchId));

/** Attach published intentions and pending change requests to Mass rows. */
async function hydrate(dbx: Db, rows: MassRow[]): Promise<MassView[]> {
  if (!rows.length) return [];
  const ids = rows.map((r) => r.mass.id);
  const [ints, pend] = await Promise.all([
    dbx.select().from(i).where(inArray(i.massId, ids)).orderBy(asc(i.position), asc(i.id)),
    dbx
      .select({ cr, name: schema.user.name })
      .from(cr)
      .innerJoin(schema.user, eq(schema.user.id, cr.createdBy))
      .where(and(eq(cr.status, "pending"), inArray(cr.action, ["intention.add", "mass.cancel"])))
      .orderBy(asc(cr.createdAt), asc(cr.id)),
  ]);
  return rows.map(({ mass, church }) => {
    const mine = pend.filter((p) => (p.cr.payload as { massId?: number }).massId === mass.id);
    const cancel = mine.find((p) => p.cr.action === "mass.cancel");
    const cp = cancel?.cr.payload as { reason?: string; intentionHandling?: "next" | "keep" } | undefined;
    return {
      id: mass.id,
      date: mass.date,
      time: hhmm(mass.time),
      churchId: mass.churchId,
      church,
      type: mass.type,
      status: mass.status,
      cancelReason: mass.cancelReason,
      note: mass.note,
      intentions: ints
        .filter((x) => x.massId === mass.id)
        .map((x) => ({ id: x.id, kind: x.kind, text: x.text, position: x.position, movedFromMassId: x.movedFromMassId })),
      pending: mine
        .filter((p) => p.cr.action === "intention.add")
        .map((p) => {
          const pl = p.cr.payload as { text: string; kind: IntentionKind };
          return { changeRequestId: p.cr.id, kind: pl.kind, text: pl.text, createdBy: p.cr.createdBy, createdByName: p.name, createdAt: p.cr.createdAt };
        }),
      pendingCancel: cancel
        ? {
            changeRequestId: cancel.cr.id,
            reason: cp?.reason || null,
            intentionHandling: cp?.intentionHandling ?? null,
            createdBy: cancel.cr.createdBy,
            createdByName: cancel.name,
            createdAt: cancel.cr.createdAt,
          }
        : null,
    };
  });
}

const hasIntention = (x: MassView) => x.intentions.length > 0 || x.pending.length > 0;

/** The week starting on Monday `weekStart` (any date in the week works). Generates missing Masses first. */
export async function getWeek(weekStart: string, dbx: Db = defaultDb): Promise<Week> {
  const start = mondayOf(weekStart);
  const end = addDays(start, 6);
  await ensureMasses(dbx, start, end);
  const rows = await massSelect(dbx)
    .where(and(gte(m.date, start), lte(m.date, end)))
    .orderBy(asc(m.date), asc(m.time), asc(schema.churches.position));
  const masses = await hydrate(dbx, rows);
  const days = dateRange(start, end).map((date) => ({
    date,
    weekday: weekdayLabel(date),
    label: dayLabel(date),
    feast: FEASTS[date] ?? null,
    masses: masses.filter((x) => x.date === date),
  }));
  const intentions = masses.reduce((n, x) => n + x.intentions.length, 0);
  const pending = masses.reduce((n, x) => n + x.pending.length, 0);
  return {
    weekStart: start,
    weekEnd: end,
    days,
    isEmpty: intentions === 0 && pending === 0,
    counts: {
      masses: masses.length,
      cancelled: masses.filter((x) => x.status === "cancelled").length,
      intentions,
      pending,
      withoutIntention: masses.filter((x) => x.status === "scheduled" && !hasIntention(x)).length,
    },
  };
}

export async function getMass(id: number, dbx: Db = defaultDb): Promise<(MassView & { label: string; feast: string | null }) | null> {
  const rows = await massSelect(dbx).where(eq(m.id, id));
  const [mass] = await hydrate(dbx, rows);
  return mass ? { ...mass, label: dayLabel(mass.date), feast: FEASTS[mass.date] ?? null } : null;
}

/** Masses after the clock's now that still take place, in order. */
async function upcoming(dbx: Db, limit: number): Promise<MassView[]> {
  const d = today();
  const rows = await massSelect(dbx)
    .where(and(eq(m.status, "scheduled"), or(gt(m.date, d), and(eq(m.date, d), gt(m.time, sql`${nowTime()}::time`)))))
    .orderBy(asc(m.date), asc(m.time), asc(schema.churches.position))
    .limit(limit);
  return hydrate(dbx, rows);
}

/** The first scheduled Mass after now (Domov hero). */
export async function getNextMass(dbx: Db = defaultDb): Promise<MassView | null> {
  await ensureMasses(dbx, today(), addDays(today(), 7));
  const [next] = await upcoming(dbx, 1);
  return next ?? null;
}

/** Scheduled Masses of the week with no intention; a pending intention counts as one (US-004). */
export async function getMassesWithoutIntention(weekStart: string, dbx: Db = defaultDb): Promise<MassView[]> {
  const week = await getWeek(weekStart, dbx);
  return week.days.flatMap((d) => d.masses).filter((x) => x.status === "scheduled" && !hasIntention(x));
}

/** Upcoming Masses for the "Nov namen" picker (next 8 weeks, FR-7). */
export async function getUpcomingMasses(limit = 60, dbx: Db = defaultDb): Promise<(MassView & { label: string })[]> {
  await ensureMasses(dbx, today(), addDays(today(), 8 * 7));
  return (await upcoming(dbx, limit)).map((x) => ({ ...x, label: dayLabel(x.date) }));
}
