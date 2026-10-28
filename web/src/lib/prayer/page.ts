/**
 * "Molitev in češčenje" (US-012): the prayerPage singleton the priest edits
 * under Župnija. It feeds /molitev, the "Molitev" menu and footer links and
 * the homepage band "Pridite pred Najsvetejše". Without a single item the
 * page is a 404 and every link to it is hidden.
 */
import "server-only";
import { cache } from "react";
import { contentStore, readPrayerPage, type PrayerItem, type PrayerPageDoc } from "@/lib/content/read";

export type { PrayerItem, PrayerPageDoc };

/** The page when it has at least one item, else null. */
export const getPrayerPage = cache(async (): Promise<PrayerPageDoc | null> => {
  const page = readPrayerPage(await contentStore());
  return page?.items.length ? page : null;
});

/** Whether /molitev exists (the nav and footer show the link only then). */
export async function hasPrayerPage(): Promise<boolean> {
  return (await getPrayerPage()) !== null;
}

/** "prvi petek v mesecu, 15.00–18.30 · Marijina cerkev" */
export function prayerItemLine(item: Pick<PrayerItem, "when" | "place">): string {
  return [item.when, item.place].filter(Boolean).join(" · ");
}
