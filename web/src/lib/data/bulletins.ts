/**
 * Public weekly bulletins (tedenska oznanila), from Postgres.
 *
 * Only bulletins with status "published" are read; drafts, bulletins waiting
 * for the priest and unreadable uploads never appear. The uploaded sheet is
 * never public (FR-15): the site shows the notices as text, and the Masses
 * and intentions of the week come from src/lib/data/masses.ts.
 */
import "server-only";
import { and, asc, count, desc, eq, inArray, lte } from "drizzle-orm";
import { db, schema } from "@/db";
import { today } from "@/lib/clock";
import { addDays, type IsoDate } from "@/lib/dates";
import { cached } from "./cache";

export type BulletinNotice = { key: string; text: string };

export type PublicBulletin = {
  id: number;
  /** Sunday */
  weekStart: IsoDate;
  /** Saturday */
  weekEnd: IsoDate;
  notices: BulletinNotice[];
};

export type BulletinListItem = { id: number; weekStart: IsoDate; weekEnd: IsoDate; itemCount: number };

const b = schema.bulletins;
const n = schema.bulletinNotices;

async function withNotices(rows: { id: number; weekStart: string }[]): Promise<PublicBulletin[]> {
  if (!rows.length) return [];
  const notices = await db
    .select()
    .from(n)
    .where(inArray(n.bulletinId, rows.map((r) => r.id)))
    .orderBy(asc(n.position), asc(n.id));
  return rows.map((r) => ({
    id: r.id,
    weekStart: r.weekStart,
    weekEnd: addDays(r.weekStart, 6),
    notices: notices.filter((x) => x.bulletinId === r.id).map((x) => ({ key: `n${x.id}`, text: x.text })),
  }));
}

const latestFrom = cached(
  async (lastStart: IsoDate): Promise<PublicBulletin | null> => {
    const rows = await db
      .select({ id: b.id, weekStart: b.weekStart })
      .from(b)
      .where(and(eq(b.status, "published"), lte(b.weekStart, lastStart)))
      .orderBy(desc(b.weekStart))
      .limit(1);
    return (await withNotices(rows))[0] ?? null;
  },
  "bulletins:current",
  ["bulletins"],
);

const byWeek = cached(
  async (weekStart: IsoDate): Promise<PublicBulletin | null> => {
    const rows = await db
      .select({ id: b.id, weekStart: b.weekStart })
      .from(b)
      .where(and(eq(b.status, "published"), eq(b.weekStart, weekStart)));
    return (await withNotices(rows))[0] ?? null;
  },
  "bulletins:week",
  ["bulletins"],
);

const list = cached(
  async (): Promise<BulletinListItem[]> => {
    const rows = await db
      .select({ id: b.id, weekStart: b.weekStart, itemCount: count(n.id) })
      .from(b)
      .leftJoin(n, eq(n.bulletinId, b.id))
      .where(eq(b.status, "published"))
      .groupBy(b.id)
      .orderBy(desc(b.weekStart))
      .limit(52);
    return rows.map((r) => ({ ...r, weekEnd: addDays(r.weekStart, 6) }));
  },
  "bulletins:list",
  ["bulletins"],
);

/**
 * The bulletin to show now: the latest published week that has started.
 * Weeks start on Sunday, so the bulletin read out at Mass that day counts from that Sunday on.
 */
export async function getCurrentBulletin(): Promise<PublicBulletin | null> {
  return latestFrom(today());
}

/** The published bulletin of the week starting on Sunday `weekStart`. */
export async function getBulletinByWeek(weekStart: IsoDate): Promise<PublicBulletin | null> {
  return byWeek(weekStart);
}

/** Published bulletins, newest first (at most 52), with their notice counts. */
export async function getBulletinList(): Promise<BulletinListItem[]> {
  return list();
}
