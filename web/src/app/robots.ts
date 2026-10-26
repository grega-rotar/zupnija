import type { MetadataRoute } from "next";
import { getSettings } from "@/sanity/data";
import { siteUrl } from "@/lib/seo";

export default async function robots(): Promise<MetadataRoute.Robots> {
  const settings = await getSettings();
  const base = siteUrl(settings);
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/api/", "/iskanje"] }],
    sitemap: `${base}/sitemap.xml`,
  };
}
