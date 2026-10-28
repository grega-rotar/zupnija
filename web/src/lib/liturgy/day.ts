/**
 * The liturgical day for the homepage (US-003): what the published bulletin
 * wrote into calendar_days wins, then hozana.si's free day file, then nothing.
 * Readings: the references from hozana's api.php when HOZANA_API_KEY is set
 * (readings-data.ts), otherwise empty; /berila has the full text.
 */
import "server-only";
import { eq } from "drizzle-orm";
import { unstable_cache } from "next/cache";
import { db, schema } from "@/db";
import type { IsoDate } from "@/lib/dates";
import { cached } from "@/lib/data/cache";
import { fetchHozanaDay, hozanaUrl, type HozanaDay } from "./hozana";
import { getReadings } from "./readings-data";

export type Reading = { label: "Berilo" | "Psalm" | "Evangelij" | string; ref: string };

export type LiturgicalDay = {
  date: IsoDate;
  title: string;
  /** "praznik", "slovesni praznik", "obvezni god"; null on an ordinary day or when unknown. */
  rank: string | null;
  /** Sundays, from the bulletin: "30. nedelja med letom". */
  sundayName: string | null;
  gospelLine: string | null;
  readings: Reading[];
  source: "oznanila" | "hozana";
  /** The day on hozana.si, for "Preberi današnja berila". */
  url: string;
};

const calendarDay = cached(
  async (date: IsoDate) => {
    const [row] = await db.select().from(schema.calendarDays).where(eq(schema.calendarDays.date, date));
    return row ? { title: row.title, sundayName: row.sundayName, gospel: row.gospel } : null;
  },
  "liturgy:calendar",
  ["masses", "bulletins"],
);

/** hozana's day, cached per date for 24 h. A failure throws so it is not cached. */
const hozanaCached = process.env.VITEST
  ? fetchHozanaDay
  : unstable_cache(
      async (date: IsoDate): Promise<HozanaDay | null> => {
        const day = await fetchHozanaDay(date);
        if (!day) throw new Error("hozana: no day");
        return day;
      },
      ["liturgy", "hozana"],
      { revalidate: 24 * 60 * 60 },
    );

async function hozanaDay(date: IsoDate): Promise<HozanaDay | null> {
  try {
    return await hozanaCached(date);
  } catch {
    return null;
  }
}

/** calendar_days (the bulletin) → hozana.si → null. */
export async function getLiturgicalDay(date: IsoDate): Promise<LiturgicalDay | null> {
  const url = hozanaUrl(date);
  const [cal, full] = await Promise.all([calendarDay(date), getReadings(date, date)]);
  const readings: Reading[] = full.available ? full.readings.map((r) => ({ label: r.label, ref: r.ref })).filter((r) => r.ref) : [];
  if (cal?.title) {
    // The bulletin has no rank; hozana's is used when it names the same day.
    const hz = await hozanaDay(date);
    const rank = hz && hz.title.toLowerCase() === cal.title.toLowerCase() ? hz.rank : null;
    return { date, title: cal.title, rank, sundayName: cal.sundayName, gospelLine: cal.gospel || hz?.gospelLine || null, readings, source: "oznanila", url };
  }
  const hz = await hozanaDay(date);
  if (!hz) return null;
  return { date, title: hz.title, rank: hz.rank, sundayName: null, gospelLine: hz.gospelLine, readings, source: "hozana", url };
}
