/**
 * The only source of "now" for editor code, so tests and the dev seed can pin
 * the date (TEST_NOW=2026-10-27T10:00:00+01:00). Dates are Europe/Ljubljana.
 */
let pinned: Date | null = process.env.TEST_NOW ? new Date(process.env.TEST_NOW) : null;

export function now(): Date {
  return pinned ? new Date(pinned) : new Date();
}

export function setNow(d: Date | string | null): void {
  pinned = d == null ? null : new Date(d);
}

const ymd = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Ljubljana", year: "numeric", month: "2-digit", day: "2-digit" });
const hm = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Ljubljana", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });

/** "2026-10-27" in Ljubljana. */
export function today(): string {
  return ymd.format(now());
}

/** "10:00" in Ljubljana. */
export function nowTime(): string {
  return hm.format(now());
}

/** Monday of the week containing `iso` ("2026-10-27" → "2026-10-26"). */
export function weekStart(iso: string = today()): string {
  const d = new Date(`${iso}T12:00:00Z`);
  const back = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - back);
  return d.toISOString().slice(0, 10);
}
