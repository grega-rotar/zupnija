import type { Metadata, Viewport } from "next";
import { Caveat, Newsreader, Source_Sans_3 } from "next/font/google";
import { getActor } from "@/lib/admin/session";
import "../globals.css";
import "./admin.css";

/*
 * The editor's own root layout (admin.<domain>, rewritten to /admin/** by the
 * proxy). It loads the site's globals.css (Tailwind, design tokens, base
 * styles) and adds admin.css for the app-only frame. None of the site chrome.
 */

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

// Only the handwritten bulletin preview uses it; downloaded when that renders.
const caveat = Caveat({
  variable: "--font-caveat",
  subsets: ["latin", "latin-ext"],
  weight: ["500", "600"],
  display: "swap",
  preload: false,
});

export const metadata: Metadata = {
  title: "Urejanje · Župnija Pirniče",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  // Light only, like the site.
  themeColor: "#fbfaf7",
};

/** Per request: who is signed in decides the text size and everything below. */
export const dynamic = "force-dynamic";

export default async function AdminRootLayout({ children }: { children: React.ReactNode }) {
  const actor = await getActor();
  const cls = [newsreader.variable, sourceSans.variable, caveat.variable, actor?.bigText ? "big" : ""].filter(Boolean).join(" ");
  return (
    <html lang="sl" className={cls}>
      <body>
        {/* Panels and toasts are portalled into #admin-app so they cover the whole frame. */}
        <div className="app" id="admin-app">
          {children}
        </div>
      </body>
    </html>
  );
}
