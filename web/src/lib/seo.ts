import type { Metadata } from "next";
import { urlFor } from "@/sanity/image";
import type { SETTINGS_QUERY_RESULT } from "@/sanity/types.generated";

type SeoImage = { asset?: { _id: string; url: string } | null } | null | undefined;

export type DocSeo = {
  title?: string | null;
  description?: string | null;
  image?: SeoImage;
  noIndex?: boolean | null;
};

/** Canonical site origin, without trailing slash. */
export function siteUrl(settings?: SETTINGS_QUERY_RESULT | null): string {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL;
  const value = settings?.siteUrl || fromEnv || "http://localhost:3000";
  return value.replace(/\/+$/, "");
}

export function absoluteUrl(path: string, settings?: SETTINGS_QUERY_RESULT | null): string {
  return new URL(path, `${siteUrl(settings)}/`).toString();
}

function ogImageUrl(image: SeoImage): string | null {
  if (!image?.asset) return null;
  return urlFor(image).width(1200).height(630).fit("crop").url();
}

type BuildMetadataInput = {
  settings: SETTINGS_QUERY_RESULT | null;
  /** Page title without the site name. */
  title?: string | null;
  description?: string | null;
  /** Path of the page, e.g. "/dogodki/romanje". */
  path: string;
  /** Per-document SEO overrides. */
  seo?: DocSeo | null;
  /** Content image used for sharing when no SEO image is set. */
  image?: SeoImage;
  type?: "website" | "article";
  publishedTime?: string | null;
};

/**
 * Metadata with sensible fallbacks: document SEO → content → parish settings.
 * Everything here is fetched with `stega: false` by the callers.
 */
export function buildMetadata({
  settings,
  title,
  description,
  path,
  seo,
  image,
  type = "website",
  publishedTime,
}: BuildMetadataInput): Metadata {
  const siteName = settings?.name || "Župnija Pirniče";
  const pageTitle = seo?.title || title || null;
  const fullTitle = pageTitle ? `${pageTitle} · ${siteName}` : settings?.seo?.title || siteName;
  const desc = seo?.description || description || settings?.seo?.description || settings?.tagline || undefined;
  const og = ogImageUrl(seo?.image) || ogImageUrl(image) || ogImageUrl(settings?.seo?.image);
  const url = absoluteUrl(path, settings);

  return {
    title: fullTitle,
    description: desc,
    alternates: { canonical: url },
    robots: seo?.noIndex ? { index: false, follow: false } : undefined,
    openGraph: {
      title: pageTitle || siteName,
      description: desc,
      url,
      siteName,
      locale: "sl_SI",
      type,
      ...(publishedTime ? { publishedTime } : {}),
      images: og ? [{ url: og, width: 1200, height: 630 }] : undefined,
    },
    twitter: {
      card: og ? "summary_large_image" : "summary",
      title: pageTitle || siteName,
      description: desc,
      images: og ? [og] : undefined,
    },
  };
}

// ───────────────────────── JSON-LD ─────────────────────────

export type JsonLd = Record<string, unknown>;

export function organizationJsonLd(settings: SETTINGS_QUERY_RESULT | null): JsonLd {
  const base = siteUrl(settings);
  return {
    "@context": "https://schema.org",
    "@type": "Church",
    name: settings?.name || "Župnija Pirniče",
    url: base,
    ...(settings?.email ? { email: settings.email } : {}),
    ...(settings?.phone ? { telephone: settings.phone } : {}),
    ...(settings?.address
      ? {
          address: {
            "@type": "PostalAddress",
            streetAddress: settings.address.street ?? undefined,
            postalCode: settings.address.postalCode ?? undefined,
            addressLocality: settings.address.city ?? undefined,
            addressCountry: "SI",
          },
        }
      : {}),
    ...(settings?.socialLinks?.length ? { sameAs: settings.socialLinks.map((s) => s.url) } : {}),
  };
}

export function breadcrumbJsonLd(items: { name: string; path: string }[], settings: SETTINGS_QUERY_RESULT | null): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.path, settings),
    })),
  };
}
