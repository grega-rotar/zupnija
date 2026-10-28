/**
 * The readings for /berila and the homepage (US-003): hozana's api.php,
 * cached per date for 24 h under the tag `readings:<date>`.
 *
 * Only dates near today are fetched (yesterday to a week ahead): a key has
 * 10 requests a day, and a visitor paging through the year must not use them
 * up. Other dates, and every date without HOZANA_API_KEY, get `reason:
 * "link"`: the page shows what it knows (the day, the Gospel line) and links
 * the day on hozana.si.
 */
import "server-only";
import { unstable_cache } from "next/cache";
import { addDays, type IsoDate } from "@/lib/dates";
import { fetchReadings, type HozanaReadings } from "./readings";

export type Readings = ({ available: true } & HozanaReadings) | { available: false; reason: "link" | "unavailable" };

/** The dates /berila fetches from hozana, relative to today. */
export const READINGS_WINDOW = { before: 1, after: 7 } as const;

export function inReadingsWindow(date: IsoDate, today: IsoDate): boolean {
  return date >= addDays(today, -READINGS_WINDOW.before) && date <= addDays(today, READINGS_WINDOW.after);
}

/** A failure throws inside the cache so it is not kept for a day. */
function cachedFetch(date: IsoDate): Promise<HozanaReadings | null> {
  if (process.env.VITEST) return fetchReadings(date);
  return unstable_cache(
    async () => {
      const r = await fetchReadings(date);
      if (!r) throw new Error("hozana: no readings");
      return r;
    },
    ["liturgy", "readings", date],
    { revalidate: 24 * 60 * 60, tags: [`readings:${date}`] },
  )().catch(() => null);
}

export async function getReadings(date: IsoDate, today: IsoDate): Promise<Readings> {
  if (!process.env.HOZANA_API_KEY || !inReadingsWindow(date, today)) {
    if (!process.env.HOZANA_API_KEY) await fetchReadings(date); // logs the missing key once
    return { available: false, reason: "link" };
  }
  const r = await cachedFetch(date);
  return r ? { available: true, ...r } : { available: false, reason: "unavailable" };
}
