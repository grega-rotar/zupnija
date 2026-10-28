/**
 * Date helpers. The parish lives in Europe/Ljubljana; every "today",
 * "this week" and displayed time is computed in that zone regardless of
 * where the server runs.
 */

export const TIME_ZONE = "Europe/Ljubljana";
export const LOCALE = "sl-SI";

/** ISO date string, YYYY-MM-DD. */
export type IsoDate = string;

export type Weekday =
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday"
  | "saturday"
  | "sunday";

const WEEKDAY_ORDER: Weekday[] = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];

export const WEEKDAY_LABEL: Record<Weekday, string> = {
  monday: "ponedeljek",
  tuesday: "torek",
  wednesday: "sreda",
  thursday: "četrtek",
  friday: "petek",
  saturday: "sobota",
  sunday: "nedelja",
};

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Today's date (YYYY-MM-DD) in Ljubljana. */
export function today(now: Date = new Date()): IsoDate {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** Current time HH:MM in Ljubljana. */
export function nowTime(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(now);
}

export function isIsoDate(value: unknown): value is IsoDate {
  return typeof value === "string" && ISO_DATE.test(value) && !Number.isNaN(toUtcNoon(value).getTime());
}

/** A Date at 12:00 UTC for a calendar day — safe for day arithmetic. */
function toUtcNoon(date: IsoDate): Date {
  return new Date(`${date}T12:00:00Z`);
}

export function addDays(date: IsoDate, days: number): IsoDate {
  const d = toUtcNoon(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function weekdayOf(date: IsoDate): Weekday {
  return WEEKDAY_ORDER[toUtcNoon(date).getUTCDay()];
}

/** Sunday that starts the (liturgical) week containing `date`. */
export function startOfWeek(date: IsoDate): IsoDate {
  const dow = toUtcNoon(date).getUTCDay(); // 0 = Sunday
  return addDays(date, -dow);
}

/** Inclusive list of dates from `from` to `to`. */
export function dateRange(from: IsoDate, to: IsoDate): IsoDate[] {
  const out: IsoDate[] = [];
  let cursor = from;
  let guard = 0;
  while (cursor <= to && guard < 400) {
    out.push(cursor);
    cursor = addDays(cursor, 1);
    guard += 1;
  }
  return out;
}

/** Calendar date (YYYY-MM-DD, Ljubljana) of an ISO datetime. */
export function dateOf(datetime: string): IsoDate {
  return today(new Date(datetime));
}

/** HH:MM (Ljubljana) of an ISO datetime. */
export function timeOf(datetime: string): string {
  return nowTime(new Date(datetime));
}

/** Compare HH:MM strings. */
export function compareTime(a: string, b: string): number {
  return a.padStart(5, "0").localeCompare(b.padStart(5, "0"));
}

/** Normalises "8:00" → "08:00". */
export function normaliseTime(time: string): string {
  const [h = "0", m = "00"] = time.split(":");
  return `${h.padStart(2, "0")}:${m.padStart(2, "0")}`;
}

// ───────────────────────── Formatting ─────────────────────────

const fmt = (options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat(LOCALE, { timeZone: TIME_ZONE, ...options });

const capitalise = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** "14. 9. 2026" */
export function formatDate(date: IsoDate | string): string {
  const d = isIsoDate(date) ? toUtcNoon(date) : new Date(date);
  return fmt({ day: "numeric", month: "numeric", year: "numeric", ...(isIsoDate(date) ? { timeZone: "UTC" } : {}) })
    .format(d)
    .replace(/\s+/g, " ");
}

/** "14. september 2026" */
export function formatDateLong(date: IsoDate | string): string {
  const d = isIsoDate(date) ? toUtcNoon(date) : new Date(date);
  return fmt({ day: "numeric", month: "long", year: "numeric", ...(isIsoDate(date) ? { timeZone: "UTC" } : {}) }).format(d);
}

/** "Nedelja, 14. september" */
export function formatDayHeading(date: IsoDate | string, withYear = false): string {
  const d = isIsoDate(date) ? toUtcNoon(date) : new Date(date);
  const s = fmt({
    weekday: "long",
    day: "numeric",
    month: "long",
    ...(withYear ? { year: "numeric" } : {}),
    ...(isIsoDate(date) ? { timeZone: "UTC" } : {}),
  }).format(d);
  return capitalise(s);
}

/** "ned" short weekday. */
export function formatWeekdayShort(date: IsoDate): string {
  return fmt({ weekday: "short", timeZone: "UTC" }).format(toUtcNoon(date)).replace(".", "");
}

/** "14" day-of-month number. */
export function formatDayNumber(date: IsoDate | string): string {
  const d = isIsoDate(date) ? toUtcNoon(date) : new Date(date);
  return fmt({ day: "numeric", ...(isIsoDate(date) ? { timeZone: "UTC" } : {}) }).format(d).replace(".", "");
}

/** "sep" short month. */
export function formatMonthShort(date: IsoDate | string): string {
  const d = isIsoDate(date) ? toUtcNoon(date) : new Date(date);
  return fmt({ month: "short", ...(isIsoDate(date) ? { timeZone: "UTC" } : {}) }).format(d).replace(".", "");
}

/** "14. 9. – 20. 9. 2026" */
export function formatDateSpan(from: IsoDate, to: IsoDate): string {
  if (from === to) return formatDate(from);
  const sameYear = from.slice(0, 4) === to.slice(0, 4);
  const a = fmt({ day: "numeric", month: "numeric", timeZone: "UTC" }).format(toUtcNoon(from)).replace(/\s+/g, " ");
  const b = formatDate(to);
  return sameYear ? `${a} – ${b}` : `${formatDate(from)} – ${b}`;
}

/** "september" */
export function formatMonthLong(date: IsoDate): string {
  return fmt({ month: "long", timeZone: "UTC" }).format(toUtcNoon(date));
}

/** "14. september" (no weekday, no year). */
export function formatDayMonth(date: IsoDate): string {
  return `${formatDayNumber(date)}. ${formatMonthLong(date)}`;
}

/** Short day for tight rows and pills: "tor 3. nov". */
export function formatDayShort(date: IsoDate): string {
  return `${formatWeekdayShort(date)} ${formatDayNumber(date)}. ${formatMonthShort(date)}`;
}

/**
 * A week (Sunday–Saturday) or any span of days, as a heading: "25.–31. oktober",
 * across months "28. sep – 4. okt". `withYear` adds the year: "25.–31. oktober 2026",
 * across years "28. dec 2025 – 3. jan 2026".
 */
export function formatWeekSpan(from: IsoDate, to: IsoDate, withYear = false): string {
  const day = (d: IsoDate) => formatDayNumber(d);
  const y = (d: IsoDate) => (withYear ? ` ${d.slice(0, 4)}` : "");
  if (from === to) return `${formatDayMonth(from)}${y(from)}`;
  if (from.slice(0, 7) === to.slice(0, 7)) return `${day(from)}.–${formatDayMonth(to)}${y(to)}`;
  const fromYear = from.slice(0, 4) !== to.slice(0, 4) ? y(from) : "";
  return `${day(from)}. ${formatMonthShort(from)}${fromYear} – ${day(to)}. ${formatMonthShort(to)}${y(to)}`;
}

/** "Nedelja, 14. september ob 10.00" (Slovenian time uses a dot). */
export function formatDateTime(datetime: string, allDay = false): string {
  const day = formatDayHeading(datetime, true);
  if (allDay) return day;
  return `${day} ob ${formatTime(timeOf(datetime))}`;
}

/** "10.00" — Slovenian convention for times in running text. Accepts "10:00" and Postgres "10:00:00". */
export function formatTime(time: string): string {
  const [h, m] = normaliseTime(time).split(":");
  return `${Number(h)}.${m}`;
}

/** Event span for cards: handles all-day, same-day and multi-day. */
export function formatEventWhen(start: string, end?: string | null, allDay?: boolean | null): string {
  const startDate = dateOf(start);
  if (!end) return allDay ? formatDayHeading(startDate, true) : formatDateTime(start);
  const endDate = dateOf(end);
  if (startDate === endDate) {
    if (allDay) return formatDayHeading(startDate, true);
    return `${formatDayHeading(startDate, true)}, ${formatTime(timeOf(start))}–${formatTime(timeOf(end))}`;
  }
  return formatDateSpan(startDate, endDate);
}

/** Relative day label used in the "Danes" block: today / tomorrow / weekday. */
export function relativeDayLabel(date: IsoDate, base: IsoDate): string {
  if (date === base) return "Danes";
  if (date === addDays(base, 1)) return "Jutri";
  return capitalise(WEEKDAY_LABEL[weekdayOf(date)]);
}
