import type { Metadata, Viewport } from "next";
import { Newsreader, Source_Sans_3 } from "next/font/google";
import { draftMode } from "next/headers";
import { VisualEditing } from "next-sanity/visual-editing";
import { SanityLive } from "@/sanity/live";
import { getSettings, getUrgentAnnouncements } from "@/sanity/data";
import { organizationJsonLd, siteUrl } from "@/lib/seo";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { SkipLink } from "@/components/layout/SkipLink";
import { UrgentBanner } from "@/components/layout/UrgentBanner";
import { DisableDraftMode } from "@/components/layout/DisableDraftMode";
import { JsonLdScript } from "@/components/ui/primitives";
import "./globals.css";

const newsreader = Newsreader({
  variable: "--font-newsreader",
  subsets: ["latin", "latin-ext"],
  display: "swap",
  axes: ["opsz"],
  style: ["normal", "italic"],
});

const sourceSans = Source_Sans_3({
  variable: "--font-source-sans",
  subsets: ["latin", "latin-ext"],
  display: "swap",
});

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
 * cached and invalidated by the Live Content API, so this stays fast.
 */
export const dynamic = "force-dynamic";

export const viewport: Viewport = {
  themeColor: "#fbfaf7",
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [settings, urgent, draft] = await Promise.all([getSettings(), getUrgentAnnouncements(), draftMode()]);
  const parishName = settings?.name || "Župnija Pirniče";

  return (
    <html lang="sl" className={`${newsreader.variable} ${sourceSans.variable} h-full`}>
      <body className="flex min-h-full flex-col">
        <SkipLink />
        <UrgentBanner items={urgent} />
        <Header parishName={parishName} />
        <main id="vsebina" className="flex-1">
          {children}
        </main>
        <Footer settings={settings} />
        <JsonLdScript data={organizationJsonLd(settings)} />
        <SanityLive />
        {draft.isEnabled ? (
          <>
            <DisableDraftMode />
            <VisualEditing />
          </>
        ) : null}
      </body>
    </html>
  );
}
