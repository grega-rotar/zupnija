/**
 * How the editor says when something happened, in Ljubljana time and relative
 * to the pinned clock: "8.15", "Danes", "Včeraj", "Nedelja, 25. oktober",
 * and for people "danes ob 8.15" / "pred 3 dnevi".
 */
import { now } from "@/lib/clock";
import { formatDayHeading, formatDayMonth, formatTime, nowTime, today } from "@/lib/dates";

/** "2026-10-27" in Ljubljana. */
export const ymd = (d: Date) => today(d);

/** "8.15", "18.05" (Slovenian clock style, no leading zero). */
export function clock(d: Date): string {
  return formatTime(nowTime(d));
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
  return formatDayHeading(ymd(d), ymd(d).slice(0, 4) !== ymd(ref).slice(0, 4));
}

/** For "nazadnje …": "danes ob 8.15", "včeraj ob 19.42", "pred 3 dnevi", "12. oktober". */
export function lastSeen(d: Date, ref: Date = now()): string {
  const n = daysAgo(d, ref);
  if (n <= 0) return `danes ob ${clock(d)}`;
  if (n === 1) return `včeraj ob ${clock(d)}`;
  if (n === 2) return "pred 2 dnevoma";
  if (n < 14) return `pred ${n} dnevi`;
  return formatDayMonth(ymd(d));
}
