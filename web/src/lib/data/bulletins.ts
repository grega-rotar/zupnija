/**
 * Public bulletins (oznanila), from Postgres.
 *
 * A bulletin covers a period: a month today (the parish's monthly booklet),
 * a week for the older ones, any span in general. Only bulletins with status
 * "published" are read; drafts, bulletins waiting for the priest and
 * unreadable uploads never appear. The uploaded file is public only as the
 * original PDF of a published bulletin (app/(site)/oznanila/[slug]/oznanila.pdf);
 * images stay private (FR-15). The Masses and intentions of the period come
 * from src/lib/data/masses.ts, its events from src/lib/data/events.ts.
 */
import "server-only";
import { and, asc, count, desc, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { today } from "@/lib/clock";
import { formatWeekSpan, type IsoDate } from "@/lib/dates";
import { routes } from "@/lib/routes";
import { cached } from "./cache";
import { getEventsInRange, type PublicEvent } from "./events";

export type BulletinNotice = { key: string; text: string };
export type BulletinText = { title: string; text: string };

export type PublicBulletin = {
  id: number;
  periodStart: IsoDate;
  periodEnd: IsoDate;
  /** As printed: "Oktober 2026"; older weekly ones "Teden 25. 10.–31. 10. 2026". */
  title: string;
  /** "Leto XLII, številka 10". */
  issue: string | null;
  article: BulletinText | null;
  prayerIntention: BulletinText | null;
  notices: BulletinNotice[];
  /** The original upload is a PDF: "Prenesi PDF" links to pdfUrl. */
  hasPdf: boolean;
  pdfUrl: string | null;
  /** @deprecated weekly name: periodStart. */
  weekStart: IsoDate;
  /** @deprecated weekly name: periodEnd. */
  weekEnd: IsoDate;
};

/** A bulletin with its period's events (the meetings and happenings it announced). */
export type PublicBulletinWithEvents = PublicBulletin & { events: PublicEvent[] };

export type BulletinListItem = { id: number; periodStart: IsoDate; periodEnd: IsoDate; title: string; label: string; itemCount: number; hasPdf: boolean; weekStart: IsoDate; weekEnd: IsoDate };

const b = schema.bulletins;
const n = schema.bulletinNotices;
const u = schema.uploads;
const PDF = "application/pdf";

/** "Oktober 2026" for a monthly bulletin; "25.–31. oktober 2026" for the migrated weekly ones ("Teden …"). */
export function bulletinLabel(x: { title: string; periodStart: IsoDate; periodEnd: IsoDate }): string {
  return /^Teden\b/.test(x.title) ? formatWeekSpan(x.periodStart, x.periodEnd, true) : x.title;
}

const cols = {
  id: b.id,
  periodStart: b.periodStart,
  periodEnd: b.periodEnd,
  title: b.title,
  issue: b.issue,
  article: b.article,
  prayerIntention: b.prayerIntention,
  mime: u.mime,
};
type Row = { id: number; periodStart: string; periodEnd: string; title: string; issue: string | null; article: unknown; prayerIntention: unknown; mime: string | null };

const text = (v: unknown): BulletinText | null => {
  if (!v || typeof v !== "object") return null;
  const o = v as { title?: unknown; text?: unknown };
  return typeof o.text === "string" && o.text.trim() ? { title: typeof o.title === "string" ? o.title : "", text: o.text } : null;
};

async function withNotices(rows: Row[]): Promise<PublicBulletin[]> {
  if (!rows.length) return [];
  const notices = await db
    .select()
    .from(n)
    .where(inArray(n.bulletinId, rows.map((r) => r.id)))
    .orderBy(asc(n.position), asc(n.id));
  return rows.map((r) => {
    const hasPdf = r.mime === PDF;
    return {
      id: r.id,
      periodStart: r.periodStart,
      periodEnd: r.periodEnd,
      title: r.title,
      issue: r.issue,
      article: text(r.article),
      prayerIntention: text(r.prayerIntention),
      notices: notices.filter((x) => x.bulletinId === r.id).map((x) => ({ key: `n${x.id}`, text: x.text })),
      hasPdf,
      pdfUrl: hasPdf ? routes.bulletinPdf(r.periodStart) : null,
      weekStart: r.periodStart,
      weekEnd: r.periodEnd,
    };
  });
}

const published = () => eq(b.status, "published");
const select = () => db.select(cols).from(b).leftJoin(u, eq(u.id, b.uploadId));
const length = sql`(${b.periodEnd} - ${b.periodStart})`;

/** Published bulletin covering `date`: the longest period (the month over an old week), then the latest start. */
const covering = cached(
  async (date: IsoDate): Promise<PublicBulletin | null> => {
    const rows = await select()
      .where(and(published(), lte(b.periodStart, date), gte(b.periodEnd, date)))
      .orderBy(desc(length), desc(b.periodStart))
      .limit(1);
    return (await withNotices(rows))[0] ?? null;
  },
  "bulletins:covering",
  ["bulletins"],
);

/** The latest published bulletin that started on or before `date`. */
const latestFrom = cached(
  async (date: IsoDate): Promise<PublicBulletin | null> => {
    const rows = await select()
      .where(and(published(), lte(b.periodStart, date)))
      .orderBy(desc(b.periodStart))
      .limit(1);
    return (await withNotices(rows))[0] ?? null;
  },
  "bulletins:current",
  ["bulletins"],
);

const byStart = cached(
  async (start: IsoDate): Promise<PublicBulletin | null> => {
    const rows = await select().where(and(published(), eq(b.periodStart, start)));
    return (await withNotices(rows))[0] ?? null;
  },
  "bulletins:start",
  ["bulletins"],
);

const list = cached(
  async (): Promise<BulletinListItem[]> => {
    const rows = await db
      .select({ id: b.id, periodStart: b.periodStart, periodEnd: b.periodEnd, title: b.title, mime: u.mime, itemCount: count(n.id) })
      .from(b)
      .leftJoin(n, eq(n.bulletinId, b.id))
      .leftJoin(u, eq(u.id, b.uploadId))
      .where(published())
      .groupBy(b.id, u.mime)
      .orderBy(desc(b.periodStart))
      .limit(60);
    return rows.map(({ mime, ...r }) => ({ ...r, label: bulletinLabel(r), hasPdf: mime === PDF, weekStart: r.periodStart, weekEnd: r.periodEnd }));
  },
  "bulletins:list",
  ["bulletins"],
);

const withEvents = async (x: PublicBulletin | null): Promise<PublicBulletinWithEvents | null> =>
  x ? { ...x, events: await getEventsInRange(x.periodStart, x.periodEnd) } : null;

/**
 * The bulletin to show now: the published one covering today (a month over
 * an old week), else the latest one that has started.
 */
export async function getCurrentBulletin(): Promise<PublicBulletinWithEvents | null> {
  const t = today();
  return withEvents((await covering(t)) ?? (await latestFrom(t)));
}

/** The published bulletin covering `date` (e.g. a week's Sunday on the old weekly routes). */
export async function getBulletinCovering(date: IsoDate): Promise<PublicBulletin | null> {
  return covering(date);
}

/** The published bulletin whose period starts on `periodStart`. */
export async function getBulletinByStart(periodStart: IsoDate): Promise<PublicBulletinWithEvents | null> {
  return withEvents(await byStart(periodStart));
}

/** @deprecated weekly name: the published bulletin starting on Sunday `weekStart`. */
export const getBulletinByWeek = (weekStart: IsoDate) => byStart(weekStart);

/** Published bulletins, newest first (at most 60), with their notice counts. */
export async function getBulletinList(): Promise<BulletinListItem[]> {
  return list();
}

/**
 * The stored PDF of a published bulletin starting on `periodStart`, for the
 * public download route. null for anything else (unpublished, an image, no upload).
 * Not cached: the route sets HTTP caching headers itself.
 */
export async function getPublishedPdf(periodStart: IsoDate): Promise<{ title: string; path: string; sha256: string; size: number } | null> {
  const [row] = await db
    .select({ title: b.title, path: u.path, sha256: u.sha256, size: u.size, mime: u.mime })
    .from(b)
    .innerJoin(u, eq(u.id, b.uploadId))
    .where(and(published(), eq(b.periodStart, periodStart)));
  if (!row || row.mime !== PDF) return null;
  return { title: row.title, path: row.path, sha256: row.sha256, size: row.size };
}
