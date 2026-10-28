import type { MetadataRoute } from "next";
import { getSettings } from "@/sanity/data";
import { siteUrl } from "@/lib/seo";

// Reads the site settings from Postgres, which the build has no access to.
export const dynamic = "force-dynamic";

export default async function robots(): Promise<MetadataRoute.Robots> {
  const settings = await getSettings();
  const base = siteUrl(settings);
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/api/", "/iskanje"] }],
    sitemap: `${base}/sitemap.xml`,
  };
}
