/**
 * How the editor says when something happened, in Ljubljana time and relative
 * to the pinned clock: "8.15", "Danes", "Včeraj", "Nedelja, 25. oktober",
 * and for people "danes ob 8.15" / "pred 3 dnevi".
 */
import { now } from "@/lib/clock";

const TZ = "Europe/Ljubljana";
const ymdFmt = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" });
const hmFmt = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "numeric", minute: "2-digit", hourCycle: "h23" });
const dayFmt = new Intl.DateTimeFormat("sl-SI", { timeZone: TZ, weekday: "long", day: "numeric", month: "long" });
const dayYearFmt = new Intl.DateTimeFormat("sl-SI", { timeZone: TZ, weekday: "long", day: "numeric", month: "long", year: "numeric" });
const shortFmt = new Intl.DateTimeFormat("sl-SI", { timeZone: TZ, day: "numeric", month: "long" });

/** "2026-10-27" in Ljubljana. */
export const ymd = (d: Date) => ymdFmt.format(d);

/** "8.15", "18.05" (Slovenian clock style, no leading zero). */
export function clock(d: Date): string {
  return hmFmt.format(d).replace(":", ".").replace(/^0(\d)/, "$1");
}

/** Whole calendar days from `d` to today (0 = today, 1 = yesterday). */
function daysAgo(d: Date, ref: Date): number {
  const a = Date.parse(`${ymd(d)}T00:00:00Z`), b = Date.parse(`${ymd(ref)}T00:00:00Z`);
  return Math.round((b - a) / 86_400_000);
}

/** History day heading: "Danes", "Včeraj", "Nedelja, 25. oktober" (year added when it isn't this year). */
export function dayLabel(d: Date, ref: Date = now()): string {
  const n = daysAgo(d, ref);
  if (n === 0) return "Danes";
  if (n === 1) return "Včeraj";
  const s = (ymd(d).slice(0, 4) === ymd(ref).slice(0, 4) ? dayFmt : dayYearFmt).format(d);
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** For "nazadnje …": "danes ob 8.15", "včeraj ob 19.42", "pred 3 dnevi", "12. oktober". */
export function lastSeen(d: Date, ref: Date = now()): string {
  const n = daysAgo(d, ref);
  if (n <= 0) return `danes ob ${clock(d)}`;
  if (n === 1) return `včeraj ob ${clock(d)}`;
  if (n === 2) return "pred 2 dnevoma";
  if (n < 14) return `pred ${n} dnevi`;
  return shortFmt.format(d);
}
