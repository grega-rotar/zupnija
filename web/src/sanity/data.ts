import { cache } from "react";
import { asc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { now as clockNow, today } from "@/lib/clock";
import { addDays, type IsoDate } from "@/lib/dates";
import { cached, hhmm } from "@/lib/data/cache";
import * as events from "@/lib/data/events";
import * as masses from "@/lib/data/masses";
import * as read from "@/lib/content/read";
import type { CURRENT_SCHEDULES_QUERY_RESULT } from "./types.generated";

/**
 * The website's data layer. Pages call these functions and never build
 * queries themselves. The names and result types are the ones the GROQ
 * queries had (src/sanity/queries/*.ts, types.generated.ts); the content now
 * lives in Postgres and is read through src/lib/content/read.ts (cached,
 * tag "content", revalidated by the editor's content actions).
 *
 * Masses and events come from their own tables (src/lib/data/*), as on the
 * rest of the site. Bulletins and Verouk groups too: the functions below
 * that used to read Sanity's weeklyBulletin / catechesisGroup documents keep
 * their names and find none (use src/lib/data/bulletins.ts and verouk.ts).
 *
 * "Now" comes from src/lib/clock (TEST_NOW pins it), rounded to the minute.
 * The `stega` parameters are left from Sanity's visual editing and ignored.
 */

function nowIso(): string {
  const d = clockNow();
  d.setSeconds(0, 0);
  return d.toISOString();
}

const store = read.contentStore;

// ───────────────────────── Global ─────────────────────────

export const getSettings = cache(async () => read.readSettings(await store()));

export const getContactRecipient = cache(async () => read.readContactRecipient(await store()));

export const getActiveSpecialPeriod = cache(async () => read.readActiveSpecialPeriod(await store(), today()));

export const getUrgentAnnouncements = cache(async () => read.readUrgentAnnouncements(await store(), nowIso()));

// ───────────────────────── Masses ─────────────────────────

/** Concrete Masses for a date range (inclusive), from Postgres (src/lib/data/masses.ts). */
export const getMassDays = cache(masses.getMassDays);

/** Today + next 7 days, plus the current time for "what is still ahead". */
export const getUpcomingMasses = masses.getUpcomingMasses;

/** The week (Sunday → Saturday) that contains `date`. */
export const getMassWeek = masses.getMassWeek;

const WEEKDAY_NAME = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"] as const;

type ScheduleRow = {
  id: number;
  weekdays: number[];
  time: string;
  type: string;
  note: string | null;
  validFrom: string | null;
  validUntil: string | null;
  church: { slug: string; name: string; shortName: string };
};

const loadScheduleRows = cached(
  async (): Promise<ScheduleRow[]> => {
    const e = schema.massScheduleEntries;
    const c = schema.churches;
    return db
      .select({
        id: e.id,
        weekdays: e.weekdays,
        time: e.time,
        type: e.type,
        note: e.note,
        validFrom: e.validFrom,
        validUntil: e.validUntil,
        church: { slug: c.slug, name: c.name, shortName: c.shortName },
      })
      .from(e)
      .innerJoin(c, eq(c.id, e.churchId))
      .orderBy(asc(c.position), asc(e.time), asc(e.id));
  },
  "massSchedule",
  ["masses"],
);

/**
 * The regular schedule plus any dated one valid today or starting within 60
 * days, in the shape of the old massSchedule documents. From the editor's
 * mass_schedule_entries: undated entries form the regular schedule, entries
 * with the same dates one dated schedule each. Title and note come from the
 * massSchedule document with those dates (imported from Sanity), if any.
 */
export const getCurrentSchedules = cache(async (): Promise<CURRENT_SCHEDULES_QUERY_RESULT> => {
  const t = today();
  const horizon = addDays(t, 60);
  const current = (from: string | null, until: string | null) =>
    (!from && !until) || ((!from || from <= t) && (!until || until >= t)) || (!!from && from > t && from <= horizon);
  const key = (from: string | null, until: string | null) => `${from ?? ""}|${until ?? ""}`;
  const [rows, s] = await Promise.all([loadScheduleRows(), store()]);

  const groups = new Map<string, ScheduleRow[]>();
  for (const r of rows) {
    if (!current(r.validFrom, r.validUntil)) continue;
    const k = key(r.validFrom, r.validUntil);
    groups.set(k, [...(groups.get(k) ?? []), r]);
  }
  // The schedule documents (title, note) imported from Sanity, matched to the entries by their dates.
  const docs = new Map<string, read.ScheduleDoc>();
  for (const d of read.readScheduleDocs(s)) {
    if (current(d.validFrom, d.validUntil) && !docs.has(key(d.validFrom, d.validUntil))) docs.set(key(d.validFrom, d.validUntil), d);
  }

  return [...new Set([...docs.keys(), ...groups.keys()])]
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
    .map((k) => {
      const list = groups.get(k) ?? [];
      const [from, until] = k.split("|").map((x) => x || null);
      const doc = docs.get(k);
      return {
        _id: doc?._id ?? (k === "|" ? "schedule-redni" : `schedule-${k.replace("|", "-")}`),
        title: doc?.title ?? (k === "|" ? "Redni urnik" : "Spremenjen urnik"),
        validFrom: from,
        validUntil: until,
        replacesRegular: doc ? doc.replacesRegular : k === "|" ? null : true,
        note: (doc?.note ?? null) as CURRENT_SCHEDULES_QUERY_RESULT[number]["note"],
        entries: list.map((r) => ({
          _key: `e${r.id}`,
          weekdays: r.weekdays.map((n) => WEEKDAY_NAME[n]),
          time: hhmm(r.time),
          type: r.type as "regular",
          note: r.note,
          church: { _id: read.churchIdBySlug(s, r.church.slug), name: r.church.name, shortName: r.church.shortName, slug: r.church.slug },
        })),
      };
    });
});

export const getChurchesBrief = cache(async () => read.readChurchesBrief(await store()));

// ───────────────────────── Announcements & bulletins ─────────────────────────

export async function getHomeAnnouncements() {
  return read.readHomeAnnouncements(await store(), nowIso());
}

export async function getCurrentAnnouncements() {
  return read.readCurrentAnnouncements(await store(), nowIso());
}

export async function getArchivedAnnouncements() {
  return read.readArchivedAnnouncements(await store(), nowIso());
}

export const getAnnouncement = cache(async (slug: string, stega = true) => {
  void stega;
  return read.readAnnouncement(await store(), slug);
});

export const getCurrentBulletin = cache(async () => read.readCurrentBulletin(await store(), today()));

export const getBulletinByWeek = cache(async (weekStart: IsoDate, stega = true) => {
  void stega;
  return read.readBulletinByWeek(await store(), weekStart);
});

export async function getBulletinList() {
  return read.readBulletinList(await store());
}

// ───────────────────────── Events (src/lib/data/events.ts) ─────────────────────────

export const getUpcomingEvents = events.getUpcomingEvents;

export const getHomeEvents = () => events.getHomeEvents(4);

export const getPastEvents = events.getPastEvents;

export const getEvent = cache(async (slug: string, stega = true) => {
  void stega;
  return read.readEvent(await store(), slug);
});

export const getEventsInRange = events.getEventsInRange;

// ───────────────────────── Articles & galleries ─────────────────────────

export async function getArticles() {
  return read.readArticles(await store(), nowIso());
}

export async function getHomeArticles() {
  return read.readArticles(await store(), nowIso(), 3);
}

export const getArticle = cache(async (slug: string, stega = true) => {
  void stega;
  return read.readArticle(await store(), slug, nowIso());
});

export async function getGalleries() {
  return read.readGalleries(await store());
}

export async function getHomeGalleries() {
  return read.readGalleries(await store(), 3);
}

export const getGallery = cache(async (slug: string, stega = true) => {
  void stega;
  return read.readGallery(await store(), slug);
});

// ───────────────────────── Parish ─────────────────────────

export const getChurches = cache(async () => read.readChurches(await store()));

export const getChurch = cache(async (slug: string, stega = true) => {
  void stega;
  return read.readChurch(await store(), slug);
});

export const getPeople = cache(async () => read.readPeople(await store()));

export const getGroups = cache(async () => read.readGroups(await store()));

export const getGroup = cache(async (slug: string, stega = true) => {
  void stega;
  return read.readGroup(await store(), slug, nowIso());
});

export const getSacraments = cache(async () => read.readSacraments(await store()));

export const getSacrament = cache(async (slug: string, stega = true) => {
  void stega;
  return read.readSacrament(await store(), slug);
});

export const getCatechesis = cache(async (stega = true) => {
  void stega;
  return read.readCatechesis(await store());
});

export const getDocuments = cache(async () => read.readDocuments(await store()));

export const getSpecialPeriod = cache(async (slug: string, stega = true) => {
  void stega;
  return read.readSpecialPeriod(await store(), slug);
});

export const getHomeSpecialPeriod = cache(async () => read.readHomeSpecialPeriod(await store(), today()));

// ───────────────────────── Pages ─────────────────────────

export const getHomePage = cache(async (stega = true) => {
  void stega;
  return read.readHomePage(await store());
});

export const getPage = cache(async (slug: string, stega = true) => {
  void stega;
  return read.readPage(await store(), slug);
});

// ───────────────────────── Search & sitemap ─────────────────────────

export async function search(term: string) {
  const cleaned = term.trim().replace(/[*"]/g, "");
  if (cleaned.length < 2) return [];
  // Like GROQ `match`: words; a trailing wildcard finds prefixes.
  const words = cleaned.split(/\s+/).map((w) => `${w}*`);
  return read.readSearch(await store(), words);
}

export async function getSitemapEntries() {
  return read.readSitemapEntries(await store());
}
