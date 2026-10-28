/**
 * Events and Masses as calendar entries (src/lib/calendar/ics.ts), for the
 * per-event .ics, the Google link and the /koledar.ics feed. Published data
 * only, through the public data layer; cancelled Masses are left out.
 */
import "server-only";
import type { SETTINGS_QUERY_RESULT } from "@/sanity/types.generated";
import { today } from "@/lib/clock";
import { addDays, dateOf, timeOf } from "@/lib/dates";
import { getEventsInRange, type PublicEvent, type PublicEventDetail } from "@/lib/data/events";
import { getMassDays } from "@/lib/data/masses";
import { INTENTION_PREFIX, type Mass } from "@/lib/masses";
import { absoluteUrl } from "@/lib/seo";
import { routes } from "@/lib/routes";
import { calendarIcs, type CalEvent } from "./ics";

/** The feed's window (US-010): events from 30 days ago to 180 ahead, Masses for the next 60 days. */
export const FEED_EVENTS_BACK = 30;
export const FEED_EVENTS_AHEAD = 180;
export const FEED_MASSES_AHEAD = 60;

export const FEED_PATH = "/koledar.ics";
export const eventIcsPath = (slug: string) => `${routes.event(slug)}/dogodek.ics`;

/** An event (card or page shape) as a calendar entry. */
export function eventToCal(e: PublicEvent | PublicEventDetail, settings: SETTINGS_QUERY_RESULT | null): CalEvent {
  const text = "descriptionText" in e ? e.descriptionText : e.summary;
  return {
    uid: e._id, // "event-12"
    title: e.title,
    date: dateOf(e.start),
    time: timeOf(e.start),
    location: e.locationName,
    description: text || null,
    url: absoluteUrl(routes.event(e.slug), settings),
  };
}

/** A Mass as "Sveta maša · Marijina cerkev", its intentions in the description. */
export function massToCal(date: string, m: Mass, settings: SETTINGS_QUERY_RESULT | null): CalEvent {
  const church = m.church?.shortName || m.church?.name || null;
  const intentions = m.intentions.map((i) => [INTENTION_PREFIX[i.kind ?? ""], i.text].filter(Boolean).join(" "));
  return {
    uid: `mass-${m.key.replace(/^m/, "")}`,
    title: church ? `Sveta maša · ${church}` : "Sveta maša",
    date,
    time: m.time,
    location: m.church?.name ?? null,
    description: [...intentions, m.note].filter(Boolean).join("\n") || null,
    url: absoluteUrl(routes.masses, settings),
  };
}

/** Every entry of /koledar.ics, soonest first. */
export async function feedEntries(settings: SETTINGS_QUERY_RESULT | null): Promise<CalEvent[]> {
  const t = today();
  const [events, days] = await Promise.all([
    getEventsInRange(addDays(t, -FEED_EVENTS_BACK), addDays(t, FEED_EVENTS_AHEAD)),
    getMassDays(t, addDays(t, FEED_MASSES_AHEAD)),
  ]);
  const masses = days.flatMap((d) => d.masses.filter((m) => m.status !== "cancelled").map((m) => massToCal(d.date, m, settings)));
  return [...events.map((e) => eventToCal(e, settings)), ...masses].sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));
}

/** The /koledar.ics feed. */
export async function feedIcs(settings: SETTINGS_QUERY_RESULT | null, now?: Date): Promise<string> {
  return calendarIcs(await feedEntries(settings), { name: settings?.name || "Župnija Pirniče", now });
}

/** Response headers of every .ics route. */
export function icsHeaders(filename: string): HeadersInit {
  return {
    "Content-Type": "text/calendar; charset=utf-8",
    "Content-Disposition": `inline; filename="${filename}"`,
    "Cache-Control": "public, max-age=300, stale-while-revalidate=3600",
    "X-Content-Type-Options": "nosniff",
  };
}
