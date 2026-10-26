import { cache } from "react";
import type { ClientReturn, QueryParams } from "next-sanity";
import { addDays, nowTime, startOfWeek, today, type IsoDate } from "@/lib/dates";
import { buildMassDays, type MassDay } from "@/lib/masses";
import { sanityFetch } from "./live";
import {
  ACTIVE_SPECIAL_PERIOD_QUERY,
  CONTACT_RECIPIENT_QUERY,
  SETTINGS_QUERY,
  URGENT_ANNOUNCEMENTS_QUERY,
} from "./queries/settings";
import {
  CHURCHES_BRIEF_QUERY,
  CURRENT_SCHEDULES_QUERY,
  MASS_DAYS_QUERY,
  MASS_SCHEDULES_QUERY,
} from "./queries/masses";
import {
  ANNOUNCEMENT_QUERY,
  ARCHIVED_ANNOUNCEMENTS_QUERY,
  ARTICLE_QUERY,
  ARTICLES_QUERY,
  BULLETIN_BY_WEEK_QUERY,
  BULLETIN_LIST_QUERY,
  CATECHESIS_QUERY,
  CHURCH_QUERY,
  CHURCHES_QUERY,
  CURRENT_ANNOUNCEMENTS_QUERY,
  CURRENT_BULLETIN_QUERY,
  DOCUMENTS_QUERY,
  EVENT_QUERY,
  EVENTS_IN_RANGE_QUERY,
  GALLERIES_QUERY,
  GALLERY_QUERY,
  GROUP_QUERY,
  GROUPS_QUERY,
  HOME_ANNOUNCEMENTS_QUERY,
  HOME_ARTICLES_QUERY,
  HOME_EVENTS_QUERY,
  HOME_GALLERIES_QUERY,
  HOME_PAGE_QUERY,
  HOME_SPECIAL_PERIOD_QUERY,
  PAGE_QUERY,
  PAST_EVENTS_QUERY,
  PEOPLE_QUERY,
  SACRAMENT_QUERY,
  SACRAMENTS_QUERY,
  SEARCH_QUERY,
  SITEMAP_QUERY,
  SPECIAL_PERIOD_QUERY,
  UPCOMING_EVENTS_QUERY,
} from "./queries/content";

/**
 * The website's data layer. Pages call these functions and never build
 * queries themselves. Every function goes through `sanityFetch`, which
 * caches published content and refreshes it when the Studio changes.
 *
 * "Now"-dependent parameters are rounded so cache keys stay stable:
 *  - dates to the day (Ljubljana time)
 *  - timestamps to the minute
 */

function nowIso(): string {
  const d = new Date();
  d.setSeconds(0, 0);
  return d.toISOString();
}

/** Metadata fetches must never contain stega characters. */
const clean = { stega: false } as const;

type LoadOptions<Q extends string> = {
  query: Q;
  params?: QueryParams;
  stega?: boolean;
  perspective?: "published" | "drafts";
};

/**
 * Thin wrapper around `sanityFetch` that returns the plain TypeGen result
 * type. In draft mode strings may carry invisible stega markers; anything
 * that *compares* a string value must go through `stegaClean` first
 * (see lib/clean.ts).
 */
async function load<const Q extends string>({ stega, ...options }: LoadOptions<Q>): Promise<ClientReturn<Q, unknown>> {
  // `false` disables stega explicitly; otherwise defineLive decides
  // (enabled only while Draft Mode is on).
  const { data } = await sanityFetch({ ...options, stega: stega === false ? false : undefined });
  return data as ClientReturn<Q, unknown>;
}

// ───────────────────────── Global ─────────────────────────

export const getSettings = cache(async () => {
  return load({ query: SETTINGS_QUERY, ...clean });
});

export const getContactRecipient = cache(async () => {
  return load({ query: CONTACT_RECIPIENT_QUERY, ...clean });
});

export const getActiveSpecialPeriod = cache(async () => {
  return load({ query: ACTIVE_SPECIAL_PERIOD_QUERY, params: { today: today() } });
});

export const getUrgentAnnouncements = cache(async () => {
  return load({ query: URGENT_ANNOUNCEMENTS_QUERY, params: { now: nowIso() } });
});

// ───────────────────────── Masses ─────────────────────────

/** Concrete Masses for a date range (inclusive), computed from schedules + Mass days. */
export const getMassDays = cache(async (from: IsoDate, to: IsoDate): Promise<MassDay[]> => {
  const [schedules, days] = await Promise.all([
    load({ query: MASS_SCHEDULES_QUERY, params: { from, to } }),
    load({ query: MASS_DAYS_QUERY, params: { from, to } }),
  ]);
  return buildMassDays(from, to, schedules, days);
});

/** Today + next 7 days, plus the current time for "what is still ahead". */
export async function getUpcomingMasses(days = 7) {
  const from = today();
  const to = addDays(from, days);
  const list = await getMassDays(from, to);
  return { today: from, time: nowTime(), days: list };
}

/** The week (Sunday → Saturday) that contains `date`. */
export async function getMassWeek(date: IsoDate) {
  const from = startOfWeek(date);
  const to = addDays(from, 6);
  const days = await getMassDays(from, to);
  return { from, to, days };
}

export const getCurrentSchedules = cache(async () => {
  const t = today();
  return load({
    query: CURRENT_SCHEDULES_QUERY,
    params: { today: t, horizon: addDays(t, 60) },
  });
});

export const getChurchesBrief = cache(async () => {
  return load({ query: CHURCHES_BRIEF_QUERY });
});

// ───────────────────────── Announcements & bulletins ─────────────────────────

export async function getHomeAnnouncements() {
  return load({ query: HOME_ANNOUNCEMENTS_QUERY, params: { now: nowIso() } });
}

export async function getCurrentAnnouncements() {
  return load({ query: CURRENT_ANNOUNCEMENTS_QUERY, params: { now: nowIso() } });
}

export async function getArchivedAnnouncements() {
  return load({ query: ARCHIVED_ANNOUNCEMENTS_QUERY, params: { now: nowIso() } });
}

export const getAnnouncement = cache(async (slug: string, stega = true) => {
  return load({ query: ANNOUNCEMENT_QUERY, params: { slug }, stega });
});

export const getCurrentBulletin = cache(async () => {
  return load({ query: CURRENT_BULLETIN_QUERY, params: { today: today() } });
});

export const getBulletinByWeek = cache(async (weekStart: IsoDate, stega = true) => {
  return load({ query: BULLETIN_BY_WEEK_QUERY, params: { weekStart }, stega });
});

export async function getBulletinList() {
  return load({ query: BULLETIN_LIST_QUERY });
}

// ───────────────────────── Events ─────────────────────────

export async function getUpcomingEvents(limit = 30) {
  const data = await load({ query: UPCOMING_EVENTS_QUERY, params: { now: nowIso() } });
  return data.slice(0, limit);
}

export async function getHomeEvents() {
  return load({ query: HOME_EVENTS_QUERY, params: { now: nowIso() } });
}

export async function getPastEvents() {
  return load({ query: PAST_EVENTS_QUERY, params: { now: nowIso() } });
}

export const getEvent = cache(async (slug: string, stega = true) => {
  return load({ query: EVENT_QUERY, params: { slug }, stega });
});

export async function getEventsInRange(from: IsoDate, to: IsoDate) {
  return load({
    query: EVENTS_IN_RANGE_QUERY,
    params: { from: `${from}T00:00:00Z`, to: `${to}T23:59:59Z` },
  });
}

// ───────────────────────── Articles & galleries ─────────────────────────

export async function getArticles() {
  return load({ query: ARTICLES_QUERY, params: { now: nowIso() } });
}

export async function getHomeArticles() {
  return load({ query: HOME_ARTICLES_QUERY, params: { now: nowIso() } });
}

export const getArticle = cache(async (slug: string, stega = true) => {
  return load({ query: ARTICLE_QUERY, params: { slug, now: nowIso() }, stega });
});

export async function getGalleries() {
  return load({ query: GALLERIES_QUERY });
}

export async function getHomeGalleries() {
  return load({ query: HOME_GALLERIES_QUERY });
}

export const getGallery = cache(async (slug: string, stega = true) => {
  return load({ query: GALLERY_QUERY, params: { slug }, stega });
});

// ───────────────────────── Parish ─────────────────────────

export const getChurches = cache(async () => {
  return load({ query: CHURCHES_QUERY });
});

export const getChurch = cache(async (slug: string, stega = true) => {
  return load({ query: CHURCH_QUERY, params: { slug }, stega });
});

export const getPeople = cache(async () => {
  return load({ query: PEOPLE_QUERY });
});

export const getGroups = cache(async () => {
  return load({ query: GROUPS_QUERY });
});

export const getGroup = cache(async (slug: string, stega = true) => {
  return load({ query: GROUP_QUERY, params: { slug, now: nowIso() }, stega });
});

export const getSacraments = cache(async () => {
  return load({ query: SACRAMENTS_QUERY });
});

export const getSacrament = cache(async (slug: string, stega = true) => {
  return load({ query: SACRAMENT_QUERY, params: { slug }, stega });
});

export const getCatechesis = cache(async (stega = true) => {
  return load({ query: CATECHESIS_QUERY, stega });
});

export const getDocuments = cache(async () => {
  return load({ query: DOCUMENTS_QUERY });
});

export const getSpecialPeriod = cache(async (slug: string, stega = true) => {
  return load({ query: SPECIAL_PERIOD_QUERY, params: { slug }, stega });
});

export const getHomeSpecialPeriod = cache(async () => {
  return load({ query: HOME_SPECIAL_PERIOD_QUERY, params: { today: today() } });
});

// ───────────────────────── Pages ─────────────────────────

export const getHomePage = cache(async (stega = true) => {
  return load({ query: HOME_PAGE_QUERY, stega });
});

export const getPage = cache(async (slug: string, stega = true) => {
  return load({ query: PAGE_QUERY, params: { slug }, stega });
});

// ───────────────────────── Search & sitemap ─────────────────────────

export async function search(term: string) {
  const cleaned = term.trim().replace(/[*"]/g, "");
  if (cleaned.length < 2) return [];
  // GROQ `match` works on words; a trailing wildcard finds prefixes.
  const words = cleaned.split(/\s+/).map((w) => `${w}*`);
  return load({ query: SEARCH_QUERY, params: { term: words }, stega: false });
}

export async function getSitemapEntries() {
  return load({ query: SITEMAP_QUERY, perspective: "published", stega: false });
}
