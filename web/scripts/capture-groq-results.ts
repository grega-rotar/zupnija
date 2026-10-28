// Captures what the old GROQ queries return from the live Sanity dataset, once, as the fixture
// the Postgres data layer is tested against (src/lib/content/read.test.ts):
//
//   npx tsx scripts/capture-groq-results.ts      # from web/; writes src/test/fixtures/groq-results.json
//
// "Now" is pinned to TEST_NOW (vitest.config.ts) rounded to the minute, like src/sanity/data.ts.
// Every slug of every type is captured, plus a missing one. Public API, no token, published only.
import { writeFileSync } from "node:fs";
import path from "node:path";
import * as content from "../src/sanity/queries/content";
import * as settings from "../src/sanity/queries/settings";
import * as masses from "../src/sanity/queries/masses";

const NOW = "2026-10-27T09:00:00.000Z";
const TODAY = "2026-10-27";
const project = process.env.SANITY_PROJECT_ID ?? "hnwav9pa";
const dataset = process.env.SANITY_DATASET ?? "production";

async function groq(query: string, params: Record<string, unknown> = {}) {
  const url = new URL(`https://${project}.apicdn.sanity.io/v2026-09-14/data/query/${dataset}`);
  url.searchParams.set("query", query);
  url.searchParams.set("perspective", "published");
  for (const [k, v] of Object.entries(params)) url.searchParams.set(`$${k}`, JSON.stringify(v));
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  return (await res.json()).result;
}

const slugs = async (type: string): Promise<string[]> =>
  [...(await groq(`*[_type == $type && defined(slug.current)].slug.current`, { type })), "ni-takega"].sort();

const out: Record<string, unknown> = { now: NOW, today: TODAY };
const put = async (key: string, query: string, params: Record<string, unknown> = {}) => {
  out[key] = await groq(query, params);
};

async function main() {
  await put("getSettings", settings.SETTINGS_QUERY);
  await put("getContactRecipient", settings.CONTACT_RECIPIENT_QUERY);
  await put("getActiveSpecialPeriod", settings.ACTIVE_SPECIAL_PERIOD_QUERY, { today: TODAY });
  await put("getUrgentAnnouncements", settings.URGENT_ANNOUNCEMENTS_QUERY, { now: NOW });
  await put("getChurchesBrief", masses.CHURCHES_BRIEF_QUERY);
  await put("getCurrentSchedules", masses.CURRENT_SCHEDULES_QUERY, { today: TODAY, horizon: "2026-12-26" });
  await put("getHomeAnnouncements", content.HOME_ANNOUNCEMENTS_QUERY, { now: NOW });
  await put("getCurrentAnnouncements", content.CURRENT_ANNOUNCEMENTS_QUERY, { now: NOW });
  await put("getArchivedAnnouncements", content.ARCHIVED_ANNOUNCEMENTS_QUERY, { now: NOW });
  for (const slug of await slugs("announcement")) await put(`getAnnouncement:${slug}`, content.ANNOUNCEMENT_QUERY, { slug });
  await put("getArticles", content.ARTICLES_QUERY, { now: NOW });
  await put("getHomeArticles", content.HOME_ARTICLES_QUERY, { now: NOW });
  for (const slug of await slugs("article")) await put(`getArticle:${slug}`, content.ARTICLE_QUERY, { slug, now: NOW });
  await put("getGalleries", content.GALLERIES_QUERY);
  await put("getHomeGalleries", content.HOME_GALLERIES_QUERY);
  for (const slug of await slugs("gallery")) await put(`getGallery:${slug}`, content.GALLERY_QUERY, { slug });
  await put("getChurches", content.CHURCHES_QUERY);
  for (const slug of await slugs("church")) await put(`getChurch:${slug}`, content.CHURCH_QUERY, { slug });
  await put("getPeople", content.PEOPLE_QUERY);
  await put("getGroups", content.GROUPS_QUERY);
  for (const slug of await slugs("parishGroup")) await put(`getGroup:${slug}`, content.GROUP_QUERY, { slug, now: NOW });
  await put("getSacraments", content.SACRAMENTS_QUERY);
  for (const slug of await slugs("sacrament")) await put(`getSacrament:${slug}`, content.SACRAMENT_QUERY, { slug });
  await put("getCatechesis", content.CATECHESIS_QUERY);
  await put("getDocuments", content.DOCUMENTS_QUERY);
  for (const slug of await slugs("specialPeriod")) await put(`getSpecialPeriod:${slug}`, content.SPECIAL_PERIOD_QUERY, { slug });
  await put("getHomeSpecialPeriod", content.HOME_SPECIAL_PERIOD_QUERY, { today: TODAY });
  await put("getHomePage", content.HOME_PAGE_QUERY);
  for (const slug of await slugs("page")) await put(`getPage:${slug}`, content.PAGE_QUERY, { slug });
  for (const term of ["krst", "cerkev", "sveti", "Pirniče", "birma zakrament", "oznanila", "xyzzy"]) {
    const words = term.split(/\s+/).map((w) => `${w}*`);
    await put(`search:${term}`, content.SEARCH_QUERY, { term: words });
  }
  await put("getSitemapEntries", content.SITEMAP_QUERY);

  const file = path.resolve("src/test/fixtures/groq-results.json");
  writeFileSync(file, JSON.stringify(out, null, 1) + "\n");
  console.log(`wrote ${Object.keys(out).length - 2} results to ${file}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
