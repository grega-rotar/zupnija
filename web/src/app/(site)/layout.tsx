import type { Metadata, Viewport } from "next";
import { getSettings, getUrgentAnnouncements } from "@/sanity/data";
import { organizationJsonLd, siteUrl } from "@/lib/seo";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { SkipLink } from "@/components/layout/SkipLink";
import { UrgentBanner } from "@/components/layout/UrgentBanner";
import { JsonLdScript } from "@/components/ui/primitives";
import { fontVariables } from "@/lib/fonts";
import "../globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSettings();
  const name = settings?.name || "Župnija Pirniče";
  return {
    metadataBase: new URL(siteUrl(settings)),
    title: settings?.seo?.title || name,
    description: settings?.seo?.description || settings?.tagline || undefined,
    applicationName: name,
    openGraph: { siteName: name, locale: "sl_SI", type: "website" },
    robots: { index: true, follow: true },
  };
}

/**
 * Every page is rendered per request: "today", "this week" and expiring
 * announcements depend on the current time. Content fetches are still
 * cached (tag "content") and revalidated by the editor, so this stays fast.
 *
 * Decided on purpose (2026-10, docs/TECHNICAL.md "Hitrost"), not an oversight:
 * - ISR (`revalidate`) or Cache Components would prerender at `next build`,
 *   which has no database (CI, Docker), so the build fails or bakes empty
 *   pages that are served after a deploy.
 * - Time-based ISR is stale-while-revalidate: after a quiet night the first
 *   visitor gets yesterday's "Danes". Bounding it (`expireTime`) makes those
 *   visitors wait for a render anyway.
 * - HTML in the Cloudflare cache can't be expired by `updateTag`, so editor
 *   changes would no longer show at once.
 * - It isn't where the time goes: with the data cache warm a render takes
 *   ~25 ms; on production the homepage waits 144 ms vs 113 ms for a static
 *   file (Cloudflare → origin). Lighthouse's LCP is main-thread work
 *   (render delay 2–3.7 s of a 3.2–4.4 s LCP), not the server.
 */
export const dynamic = "force-dynamic";

export const viewport: Viewport = {
  themeColor: "#fafaf8",
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [settings, urgent] = await Promise.all([getSettings(), getUrgentAnnouncements()]);
  const parishName = settings?.name || "Župnija Pirniče";

  return (
    <html lang="sl" className={`${fontVariables} h-full`}>
      <body className="flex min-h-full flex-col">
        <SkipLink />
        <UrgentBanner items={urgent} />
        <Header parishName={parishName} />
        <main id="vsebina" className="flex-1">
          {children}
        </main>
        <Footer settings={settings} />
        <JsonLdScript data={organizationJsonLd(settings)} />
      </body>
    </html>
  );
}
