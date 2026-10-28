/**
 * The Postgres data layer returns what the GROQ queries returned: the real
 * dataset (src/test/fixtures/sanity-export.json, from
 * `import-sanity-content.mjs --dump`) is imported into the test database, and
 * every function of src/sanity/data.ts is compared with the live GROQ result
 * (src/test/fixtures/groq-results.json, scripts/capture-groq-results.ts), at
 * the same pinned "now" (TEST_NOW).
 *
 * Known, intended differences, normalised on the GROQ side:
 *  - asset URLs are ours: https://cdn.sanity.io/… → /media/…;
 *  - events and Verouk groups live in their own tables, so references to
 *    events resolve to null, a group's upcoming events are [] and the Verouk
 *    page's groups are [], and the Mass schedule's times come from
 *    mass_schedule_entries (compared without entries: title, dates and note);
 *  - search and the sitemap only list content types (events come from Postgres).
 */
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { resetDb } from "@/test/db";
import * as data from "@/sanity/data";
import exportFixture from "@/test/fixtures/sanity-export.json";
import groq from "@/test/fixtures/groq-results.json";
import { CONTENT_TYPES, importContent } from "../../../scripts/import-sanity-content-lib.mjs";

type J = Record<string, unknown>;
const results = groq as unknown as Record<string, unknown>;

/** The GROQ result with our URLs, and with what moved to other tables taken out. */
function normalise(v: unknown, key?: string): unknown {
  if (key === "relatedEvent") return null;
  if (typeof v === "string") return v.replace("https://cdn.sanity.io/", "/media/");
  if (Array.isArray(v)) return v.map((x) => normalise(x));
  if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, normalise(x, k)]));
  return v;
}

const sql = postgres(process.env.DATABASE_URL!, { max: 1, onnotice: () => {} });

beforeAll(async () => {
  await resetDb();
  const r = await importContent(sql, exportFixture as never, {
    store: async (a: { size?: number }) => ({ sha256: "0".repeat(64), size: a.size ?? 0 }),
  });
  expect(r.inserted).toBe(exportFixture.documents.length);
});

afterAll(async () => {
  await sql.end();
});

const calls: Record<string, (arg?: string) => Promise<unknown>> = {
  getSettings: () => data.getSettings(),
  getContactRecipient: () => data.getContactRecipient(),
  getActiveSpecialPeriod: () => data.getActiveSpecialPeriod(),
  getUrgentAnnouncements: () => data.getUrgentAnnouncements(),
  getChurchesBrief: () => data.getChurchesBrief(),
  getCurrentSchedules: () => data.getCurrentSchedules(),
  getHomeAnnouncements: () => data.getHomeAnnouncements(),
  getCurrentAnnouncements: () => data.getCurrentAnnouncements(),
  getArchivedAnnouncements: () => data.getArchivedAnnouncements(),
  getAnnouncement: (slug) => data.getAnnouncement(slug!),
  getArticles: () => data.getArticles(),
  getHomeArticles: () => data.getHomeArticles(),
  getArticle: (slug) => data.getArticle(slug!),
  getGalleries: () => data.getGalleries(),
  getHomeGalleries: () => data.getHomeGalleries(),
  getGallery: (slug) => data.getGallery(slug!),
  getChurches: () => data.getChurches(),
  getChurch: (slug) => data.getChurch(slug!),
  getPeople: () => data.getPeople(),
  getGroups: () => data.getGroups(),
  getGroup: (slug) => data.getGroup(slug!),
  getSacraments: () => data.getSacraments(),
  getSacrament: (slug) => data.getSacrament(slug!),
  getCatechesis: () => data.getCatechesis(),
  getDocuments: () => data.getDocuments(),
  getSpecialPeriod: (slug) => data.getSpecialPeriod(slug!),
  getHomeSpecialPeriod: () => data.getHomeSpecialPeriod(),
  getHomePage: () => data.getHomePage(),
  getPage: (slug) => data.getPage(slug!),
};

const keys = Object.keys(results).filter((k) => !["now", "today"].includes(k) && !k.startsWith("search:") && k !== "getSitemapEntries");

describe("content read layer = GROQ", () => {
  it("the fixture's 'now' is TEST_NOW", () => {
    expect(new Date(process.env.TEST_NOW!).toISOString()).toBe(results.now);
  });

  it.each(keys)("%s", async (key) => {
    const [name, arg] = key.split(/:(.*)/);
    let expected = normalise(results[key]) as J | null;
    if (name === "getGroup" && expected) expected = { ...expected, events: [] };
    if (name === "getCatechesis" && expected) expected = { ...expected, groups: [] };
    // The times live in mass_schedule_entries (empty here); title and note come from the imported document.
    if (name === "getCurrentSchedules") expected = (expected as unknown as J[]).map((x) => ({ ...x, entries: [] })) as never;
    expect(await calls[name](arg)).toEqual(expected);
  });

  it.each(Object.keys(results).filter((k) => k.startsWith("search:")))("%s", async (key) => {
    const term = key.slice("search:".length);
    const expected = (normalise(results[key]) as J[]).filter((r) => CONTENT_TYPES.includes(r._type as string));
    expect(await data.search(term)).toEqual(expected);
  });

  it("getSitemapEntries", async () => {
    const sortKey = (e: J) => `${e._type}/${e.slug}`;
    const expected = (results.getSitemapEntries as J[]).filter((e) => CONTENT_TYPES.includes(e._type as string));
    const got = (await data.getSitemapEntries()) as J[];
    expect([...got].sort((a, b) => sortKey(a).localeCompare(sortKey(b)))).toEqual([...expected].sort((a, b) => sortKey(a).localeCompare(sortKey(b))));
  });

  it("a second import changes nothing", async () => {
    const r = await importContent(sql, exportFixture as never, { store: async () => ({ sha256: "x", size: 0 }) });
    expect(r).toMatchObject({ inserted: 0, updated: 0, unchanged: exportFixture.documents.length, media: 0 });
  });
});
