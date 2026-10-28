/**
 * Calendar files and links for events and Masses (US-010): one .ics per
 * event, the /koledar.ics feed and the "Google koledar" link.
 *
 * Every time is the Ljubljana wall clock with TZID=Europe/Ljubljana and a
 * VTIMEZONE block (RFC 5545 §3.6.5), never UTC: a calendar app then puts a
 * 14.00 event at 14.00 on both sides of a DST switch. The Google link passes
 * the same wall-clock times with `ctz=Europe/Ljubljana`; without `ctz` Google
 * reads them in the viewer's own zone, and with a trailing "Z" as UTC (the
 * bug of the Ribnica parish site).
 */
import { TIME_ZONE, type IsoDate } from "@/lib/dates";

/** UIDs stay the same on every host (dev, staging, live), so a re-import updates instead of duplicating. */
export const UID_DOMAIN = "zupnija-pirnice.si";

export type CalEvent = {
  /** "event-12", "mass-345": the UID is `<uid>@zupnija-pirnice.si`. */
  uid: string;
  title: string;
  date: IsoDate;
  /** "14:00" (Ljubljana). */
  time: string;
  /** Length in minutes (events and Masses have no end in the editor; default 60). */
  minutes?: number;
  location?: string | null;
  description?: string | null;
  url?: string | null;
};

/**
 * Europe/Ljubljana since 1996: CET (+01:00), CEST (+02:00) from the last
 * Sunday in March 02:00 to the last Sunday in October 03:00 (EU rule).
 */
const VTIMEZONE = [
  "BEGIN:VTIMEZONE",
  `TZID:${TIME_ZONE}`,
  `X-LIC-LOCATION:${TIME_ZONE}`,
  "BEGIN:DAYLIGHT",
  "TZOFFSETFROM:+0100",
  "TZOFFSETTO:+0200",
  "TZNAME:CEST",
  "DTSTART:19700329T020000",
  "RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU",
  "END:DAYLIGHT",
  "BEGIN:STANDARD",
  "TZOFFSETFROM:+0200",
  "TZOFFSETTO:+0100",
  "TZNAME:CET",
  "DTSTART:19701025T030000",
  "RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU",
  "END:STANDARD",
  "END:VTIMEZONE",
];

/** "2026-11-01", "14:00" (+ minutes) → "20261101T140000", in wall-clock arithmetic (no zone). */
export function localStamp(date: IsoDate, time: string, plusMinutes = 0): string {
  const [y, mo, d] = date.split("-").map(Number);
  const [h, mi] = time.split(":").map(Number);
  const t = new Date(Date.UTC(y, mo - 1, d, h, mi + plusMinutes));
  const p = (n: number) => String(n).padStart(2, "0");
  return `${t.getUTCFullYear()}${p(t.getUTCMonth() + 1)}${p(t.getUTCDate())}T${p(t.getUTCHours())}${p(t.getUTCMinutes())}00`;
}

/** A UTC timestamp for DTSTAMP: "20261027T090000Z". */
const utcStamp = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

/** RFC 5545 TEXT: backslash, semicolon, comma and line breaks escaped. */
export function escapeText(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

const encoder = new TextEncoder();

/** Lines longer than 75 octets continue on the next line after CRLF + space (RFC 5545 §3.1), never inside a character. */
export function fold(line: string): string {
  if (encoder.encode(line).length <= 75) return line;
  const out: string[] = [];
  let cur = "";
  let bytes = 0;
  for (const ch of line) {
    const n = encoder.encode(ch).length;
    const limit = out.length ? 74 : 75; // continuation lines start with a space
    if (bytes + n > limit) {
      out.push(cur);
      cur = "";
      bytes = 0;
    }
    cur += ch;
    bytes += n;
  }
  out.push(cur);
  return out.join("\r\n ");
}

function vevent(e: CalEvent, stamp: Date): string[] {
  const minutes = e.minutes ?? 60;
  return [
    "BEGIN:VEVENT",
    `UID:${e.uid}@${UID_DOMAIN}`,
    `DTSTAMP:${utcStamp(stamp)}`,
    `DTSTART;TZID=${TIME_ZONE}:${localStamp(e.date, e.time)}`,
    `DTEND;TZID=${TIME_ZONE}:${localStamp(e.date, e.time, minutes)}`,
    `SUMMARY:${escapeText(e.title)}`,
    ...(e.location ? [`LOCATION:${escapeText(e.location)}`] : []),
    ...(e.description ? [`DESCRIPTION:${escapeText(e.description)}`] : []),
    ...(e.url ? [`URL:${e.url}`] : []),
    "END:VEVENT",
  ];
}

/** A VCALENDAR with the given events (CRLF line ends, folded). */
export function calendarIcs(events: CalEvent[], opts: { name?: string; now?: Date } = {}): string {
  const now = opts.now ?? new Date();
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:-//Župnija Pirniče//${UID_DOMAIN}//SL`,
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    ...(opts.name
      ? [`X-WR-CALNAME:${escapeText(opts.name)}`, `X-WR-TIMEZONE:${TIME_ZONE}`, "REFRESH-INTERVAL;VALUE=DURATION:PT6H", "X-PUBLISHED-TTL:PT6H"]
      : []),
    ...VTIMEZONE,
    ...events.flatMap((e) => vevent(e, now)),
    "END:VCALENDAR",
  ];
  return lines.map(fold).join("\r\n") + "\r\n";
}

/** One event as an .ics file ("Apple / Outlook (.ics)"). */
export function eventIcs(event: CalEvent, now?: Date): string {
  return calendarIcs([event], { now });
}

/** "Google koledar": the event form prefilled, times in Ljubljana (`ctz`), not UTC. */
export function googleCalendarUrl(e: CalEvent): string {
  const q = new URLSearchParams({
    action: "TEMPLATE",
    text: e.title,
    dates: `${localStamp(e.date, e.time)}/${localStamp(e.date, e.time, e.minutes ?? 60)}`,
    ctz: TIME_ZONE,
  });
  const details = [e.description, e.url].filter(Boolean).join("\n\n");
  if (details) q.set("details", details);
  if (e.location) q.set("location", e.location);
  return `https://calendar.google.com/calendar/render?${q}`;
}
