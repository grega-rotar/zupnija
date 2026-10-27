/**
 * Public events, from Postgres, in the card shape the site's components use
 * (`EventCardData`, the Sanity card projection).
 *
 * Only rows of the `events` table are read: a helper's proposed event or
 * edit is a pending change request and never appears until approved.
 * Slugs are "<title>-<id>"; only the id is used to look an event up.
 */
import "server-only";
import { and, asc, desc, eq, gte, lt, lte } from "drizzle-orm";
import { db, schema } from "@/db";
import { today } from "@/lib/clock";
import type { IsoDate } from "@/lib/dates";
import { truncate } from "@/lib/utils";
import type { EventCardData } from "@/components/events/EventCard";
import { cached, ljubljanaIso } from "./cache";
import { textBlocks, type TextBlock } from "./text";

export type PublicEvent = EventCardData;

/** One event page. The fields Sanity events had and the editor doesn't (image, church, organizer …) are null. */
export type PublicEventDetail = PublicEvent & {
  /** The description as rich-text blocks (the card's `summary` is a shortened copy). */
  description: TextBlock[];
  descriptionText: string;
};

const e = schema.events;
type Row = typeof e.$inferSelect;

const SLUG_MAP: Record<string, string> = { č: "c", š: "s", ž: "z", ć: "c", đ: "d" };

/** "Srečanje staršev birmancev" (id 3) → "srecanje-starsev-birmancev-3" */
export function eventSlug(id: number, title: string): string {
  const base = title
    .toLowerCase()
    .replace(/[čšžćđ]/g, (ch) => SLUG_MAP[ch])
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/, "");
  return base ? `${base}-${id}` : String(id);
}

function toCard(r: Row): PublicEvent {
  return {
    _id: `event-${r.id}`,
    title: r.title,
    slug: eventSlug(r.id, r.title),
    start: ljubljanaIso(r.date, r.time),
    end: null,
    allDay: false,
    category: null,
    summary: r.description.trim() ? truncate(r.description.trim().replace(/\s+/g, " "), 160) : null,
    featured: r.onFrontPage,
    locationName: r.place || null,
    church: null,
    image: null,
  };
}

const upcoming = cached(
  async (from: IsoDate) => (await db.select().from(e).where(gte(e.date, from)).orderBy(asc(e.date), asc(e.time), asc(e.id))).map(toCard),
  "events:upcoming",
  ["events"],
);

const past = cached(
  async (before: IsoDate) => (await db.select().from(e).where(lt(e.date, before)).orderBy(desc(e.date), desc(e.time)).limit(40)).map(toCard),
  "events:past",
  ["events"],
);

const inRange = cached(
  async (from: IsoDate, to: IsoDate) =>
    (await db.select().from(e).where(and(gte(e.date, from), lte(e.date, to))).orderBy(asc(e.date), asc(e.time), asc(e.id))).map(toCard),
  "events:range",
  ["events"],
);

const byId = cached(
  async (id: string): Promise<PublicEventDetail | null> => {
    const [row] = await db.select().from(e).where(eq(e.id, Number(id)));
    if (!row) return null;
    return { ...toCard(row), description: textBlocks(row.description, `e${row.id}p`), descriptionText: row.description.trim() };
  },
  "events:one",
  ["events"],
);

/** Events from today on, soonest first. */
export async function getUpcomingEvents(limit = 30): Promise<PublicEvent[]> {
  return (await upcoming(today())).slice(0, limit);
}

/** The homepage section: upcoming events marked "Pokaži na prvi strani" in the editor. */
export async function getHomeEvents(limit = 4): Promise<PublicEvent[]> {
  return (await upcoming(today())).filter((x) => x.featured).slice(0, limit);
}

/** Events before today, latest first (at most 40). */
export async function getPastEvents(): Promise<PublicEvent[]> {
  return past(today());
}

/** Events in [from, to] (inclusive), e.g. a bulletin's week. */
export async function getEventsInRange(from: IsoDate, to: IsoDate): Promise<PublicEvent[]> {
  return inRange(from, to);
}

/** One event by its slug ("...-12"); null when the slug has no id or the event doesn't exist. */
export async function getEvent(slug: string): Promise<PublicEventDetail | null> {
  const id = /(?:^|-)(\d{1,9})$/.exec(slug)?.[1];
  return id ? byId(id) : null;
}
