"use client";

import { useVisualEditingEnvironment } from "next-sanity/hooks";

/** Lets editors leave preview when viewing the site outside the Studio. */
export function DisableDraftMode() {
  const environment = useVisualEditingEnvironment();
  // Inside the Presentation tool the Studio controls preview itself.
  if (environment === "presentation-iframe" || environment === "presentation-window") return null;
  return (
    // A route handler, not a page: a full navigation is intended.
    // eslint-disable-next-line @next/next/no-html-link-for-pages
    <a
      href="/api/draft-mode/disable"
      className="fixed bottom-4 right-4 z-50 rounded-sm bg-ink px-4 py-2.5 text-small font-medium text-paper"
    >
      Izklopi predogled
    </a>
  );
}
