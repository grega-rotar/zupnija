/**
 * Shared plumbing for the public data layer (web/src/lib/data/*).
 *
 * The app doesn't use Cache Components (`cacheComponents` is off in
 * next.config.ts), so `"use cache"` isn't available; reads are cached with
 * `unstable_cache` and tagged. The editor's engine calls
 * `revalidateTag(tag, "max")` after every write (src/lib/admin/next.ts), with
 * the tags below.
 *
 * Every cached function takes only plain, serialisable arguments (dates as
 * YYYY-MM-DD), and "now" is resolved by the caller, so cache keys are stable
 * for a day. "Now" comes from src/lib/clock, like the editor's (TEST_NOW pins
 * it in tests and the dev seed). Results are plain JSON (no Date objects).
 */
import "server-only";
import { unstable_cache } from "next/cache";

export type DataTag = "masses" | "events" | "verouk" | "bulletins" | "content";

/**
 * Cache `fn` under `key` with `tags`. Outside Next (vitest) there is no
 * incremental cache, so the plain function runs instead.
 */
export function cached<A extends string[], R>(fn: (...args: A) => Promise<R>, key: string, tags: DataTag[]): (...args: A) => Promise<R> {
  if (process.env.VITEST) return fn;
  return unstable_cache(fn, ["data", key], { tags });
}

/** "18:30:00" (Postgres time) → "18:30". */
export const hhmm = (t: string) => t.slice(0, 5);

const offsetFmt = new Intl.DateTimeFormat("en-US", { timeZone: "Europe/Ljubljana", timeZoneName: "longOffset" });

/** Ljubljana wall-clock date + time → ISO datetime with offset ("2026-11-01T14:00:00+01:00"). */
export function ljubljanaIso(date: string, time: string): string {
  // The offset at noon UTC of that day is right except in the hour around a DST switch (never a parish event).
  const name = offsetFmt.formatToParts(new Date(`${date}T12:00:00Z`)).find((p) => p.type === "timeZoneName")?.value ?? "GMT+01:00";
  const offset = name === "GMT" ? "+00:00" : name.slice(3);
  return `${date}T${hhmm(time)}:00${offset}`;
}
