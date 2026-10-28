import type { MetadataRoute } from "next";
import { getSettings, getSitemapEntries } from "@/sanity/data";
import { absoluteUrl } from "@/lib/seo";
import { pathForDocument, routes } from "@/lib/routes";

const STATIC: { path: string; priority: number; changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"] }[] = [
  { path: routes.home, priority: 1, changeFrequency: "daily" },
  { path: routes.masses, priority: 0.9, changeFrequency: "daily" },
  { path: routes.intentions, priority: 0.7, changeFrequency: "weekly" },
  { path: routes.announcements, priority: 0.9, changeFrequency: "daily" },
  { path: routes.events, priority: 0.8, changeFrequency: "weekly" },
  { path: routes.news, priority: 0.6, changeFrequency: "weekly" },
  { path: routes.galleries, priority: 0.5, changeFrequency: "monthly" },
  { path: routes.parish, priority: 0.7, changeFrequency: "monthly" },
  { path: routes.churches, priority: 0.7, changeFrequency: "monthly" },
  { path: routes.people, priority: 0.5, changeFrequency: "monthly" },
  { path: routes.groups, priority: 0.5, changeFrequency: "monthly" },
  { path: routes.sacraments, priority: 0.8, changeFrequency: "monthly" },
  { path: routes.catechesis, priority: 0.8, changeFrequency: "monthly" },
  { path: routes.documents, priority: 0.4, changeFrequency: "monthly" },
  { path: routes.contact, priority: 0.8, changeFrequency: "monthly" },
];

// Reads the content from Postgres, which the build has no access to.
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const settings = await getSettings();
  const now = new Date();
  const entries: MetadataRoute.Sitemap = STATIC.map((s) => ({
    url: absoluteUrl(s.path, settings),
    lastModified: now,
    changeFrequency: s.changeFrequency,
    priority: s.priority,
  }));

  try {
    const docs = await getSitemapEntries();
    for (const doc of docs) {
      const path = pathForDocument(doc._type, doc.slug);
      if (!path) continue;
      entries.push({
        url: absoluteUrl(path, settings),
        lastModified: new Date(doc._updatedAt),
        changeFrequency: doc._type === "page" ? "monthly" : "weekly",
        priority: 0.6,
      });
    }
  } catch (err) {
    console.error("Sitemap: could not load documents", err);
  }
  return entries;
}
