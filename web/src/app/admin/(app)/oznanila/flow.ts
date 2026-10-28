/** The upload flow's view of a bulletin (serialisable, shared by the page and the actions). */
import "server-only";
import { and, asc, desc, eq, gte, lte, ne } from "drizzle-orm";
import { db, schema } from "@/db";
import { today } from "@/lib/clock";
import { periodName } from "@/components/admin/oznanila/format";
import type { BulletinView } from "@/lib/bulletin/service";
import type { BulletinStatus, ReadableDraft } from "@/lib/bulletin/types";
import type { SlotMass } from "@/components/admin/oznanila/Review";

export type FlowPeriod = { start: string; end: string; title: string; issue?: string | null };

export type FlowBulletin = {
  id: number;
  period: FlowPeriod;
  status: BulletinStatus;
  error: string | null;
  upload: { id: number; filename: string; mime: string; size: number } | null;
  draft: ReadableDraft | null;
  /** The period's scheduled Masses, for choosing where a hand-added intention goes. */
  masses: SlotMass[];
  /** Informative line for the review: the month is past or (partly) published already. */
  note: string | null;
  /**
   * The file is the bulletin of another period that already has one (error
   * "other_period:<title>"): that bulletin, to link to instead of an error.
   */
  other: { title: string; id: number | null; status: BulletinStatus | null } | null;
};

/** "other_period:Oktober 2026" → the existing bulletin with that title. */
async function otherPeriod(error: string | null): Promise<FlowBulletin["other"]> {
  const m = error?.match(/^other_period:(.+)$/);
  if (!m) return null;
  const title = m[1].trim();
  const b = schema.bulletins;
  const [row] = await db.select({ id: b.id, status: b.status }).from(b).where(eq(b.title, title)).orderBy(desc(b.periodStart)).limit(1);
  return { title, id: row?.id ?? null, status: row?.status ?? null };
}

/** "oktober 2026", "25.–31. oktober": whatever period a bulletin covered. */
const spanOf = (b: { periodStart: string; periodEnd: string }) => periodName({ start: b.periodStart, end: b.periodEnd });

/** The Masses of a period as they are (no generation: looking must not write). */
async function slots(start: string, end: string): Promise<SlotMass[]> {
  const m = schema.masses, c = schema.churches;
  const rows = await db
    .select({ date: m.date, time: m.time, churchSlug: c.slug })
    .from(m)
    .innerJoin(c, eq(c.id, m.churchId))
    .where(and(gte(m.date, start), lte(m.date, end), eq(m.status, "scheduled")))
    .orderBy(asc(m.date), asc(m.time));
  return rows.map((r) => ({ ...r, time: r.time.slice(0, 5) }));
}

/**
 * Not an error, just so nobody is surprised: other published bulletins
 * already cover (part of) this period, or the period has begun or ended.
 */
async function noteFor(id: number, start: string, end: string): Promise<string | null> {
  const b = schema.bulletins;
  const overlapping = await db
    .select({ title: b.title, periodStart: b.periodStart, periodEnd: b.periodEnd })
    .from(b)
    .where(and(ne(b.id, id), eq(b.status, "published"), lte(b.periodStart, end), gte(b.periodEnd, start)))
    .orderBy(asc(b.periodStart));
  const span = periodName({ start, end });
  if (overlapping.some((o) => o.periodStart <= start && o.periodEnd >= end))
    return `Oznanila za ${span} so že objavljena. Ob objavi se dodajo samo novi nameni, obstoječih ne podvojim.`;
  if (overlapping.length)
    return `Za del teh dni so oznanila že objavljena (${overlapping.map(spanOf).join(", ")}). Ob objavi se dodajo samo novi nameni, obstoječih ne podvojim.`;
  const d = today();
  if (end < d) return `Dnevi teh oznanil so že mimo. Ob objavi se nameni vseeno vpišejo, da bo koledar popoln.`;
  if (start < d) return `Nekateri dnevi teh oznanil so že mimo. Ob objavi se vpišejo tudi nameni zanje.`;
  return null;
}

export async function toFlow(b: BulletinView): Promise<FlowBulletin> {
  const d = b.readableDraft;
  const period: FlowPeriod = d ? d.period : { start: b.periodStart, end: b.periodEnd, title: b.title, issue: b.issue };
  const review = d && (b.status === "draft" || b.status === "pending");
  const [masses, note] = review ? await Promise.all([slots(period.start, period.end), noteFor(b.id, period.start, period.end)]) : [[], null];
  const other = b.status === "unreadable" ? await otherPeriod(b.error) : null;
  return { id: b.id, period, status: b.status, error: b.error, upload: b.upload, draft: d, masses, note, other };
}
