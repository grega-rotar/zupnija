/**
 * The liturgical day from hozana.si (US-003).
 *
 * hozana publishes one free file, https://hozana.si/osnovni_podatki.json
 * (about 6 MB, the whole year and a month ahead): `data` holds the days
 * (`opis` the title, `teza_opis` the rank, `vrstica` the Gospel line) and
 * `map` points "<date>-<diocese>-<order>" to the ids that apply. We read the
 * Ljubljana diocese without a religious order ("noben").
 *
 * The file is too big for Next's data cache (2 MB per entry), so it is kept
 * parsed in memory for 24 h; callers cache their small per-date result.
 * The full readings need an API key (api.php?kaj=bb) we don't have yet, so
 * the site links to hozana.si for the day instead.
 */
import type { IsoDate } from "@/lib/dates";

export const HOZANA_DATA_URL = "https://hozana.si/osnovni_podatki.json";
export const DIOCESE = "ljubljana";
const ORDER = "noben";
const TTL = 24 * 60 * 60 * 1000;
const TIMEOUT = 4000;
/** After a failure, wait this long before asking hozana again (the page must not wait 4 s on every request). */
const RETRY = 10 * 60 * 1000;

export type HozanaDay = {
  /** "Sv. Simon in Juda Tadej, apostola" */
  title: string;
  /** "slovesni praznik", "praznik", "obvezni god"; null on an ordinary day. */
  rank: string | null;
  /** "»Poklical je k sebi svoje učence …« (Lk 6,13)" */
  gospelLine: string | null;
};

type Entry = { id: string; opis?: string; teza_opis?: string; vrstica?: string };
type OsnovniPodatki = { data?: Entry[]; map?: { selektor: string; data_ids: string[] }[] };

/** Higher wins when a day has two entries (a weekday and the saint's memorial). */
const RANK_ORDER: Record<string, number> = { "slovesni praznik": 3, praznik: 2, "obvezni god": 1 };

/** "2026-10-28" → "28.10.2026", the date format hozana's links use. */
export function hozanaDate(date: IsoDate): string {
  const [y, m, d] = date.split("-");
  return `${d}.${m}.${y}`;
}

/** The day's page on hozana.si (readings, saint, Gospel). */
export function hozanaUrl(date: IsoDate): string {
  return `https://hozana.si/?datum=${hozanaDate(date)}`;
}

/** The liturgical day for `date` in `diocese`, from the parsed osnovni_podatki.json; null when the file doesn't cover it. */
export function parseOsnovniPodatki(json: unknown, date: IsoDate, diocese = DIOCESE): HozanaDay | null {
  const file = json as OsnovniPodatki;
  if (!Array.isArray(file?.data) || !Array.isArray(file?.map)) return null;
  const ids = file.map.find((x) => x.selektor === `${date}-${diocese}-${ORDER}`)?.data_ids ?? [];
  const entries = ids.map((id) => file.data!.find((x) => x.id === id)).filter((x): x is Entry => Boolean(x?.opis?.trim()));
  if (!entries.length) return null;
  const best = entries.reduce((a, b) => ((RANK_ORDER[b.teza_opis ?? ""] ?? 0) > (RANK_ORDER[a.teza_opis ?? ""] ?? 0) ? b : a));
  return { title: best.opis!.trim(), rank: best.teza_opis?.trim() || null, gospelLine: best.vrstica?.trim() || null };
}

let memory: { at: number; json: unknown } | null = null;
let failedAt = 0;
let warned = false;

/**
 * The liturgical day from hozana.si, or null when hozana is down, slow
 * (> 4 s) or has no entry for the date. Logs a failure once.
 */
export async function fetchHozanaDay(date: IsoDate, now = Date.now()): Promise<HozanaDay | null> {
  if ((!memory || now - memory.at > TTL) && now - failedAt > RETRY) {
    try {
      const res = await fetch(HOZANA_DATA_URL, { cache: "no-store", signal: AbortSignal.timeout(TIMEOUT) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      memory = { at: now, json: await res.json() };
      warned = false;
    } catch (err) {
      failedAt = now;
      if (!warned) console.warn(`[hozana] ${HOZANA_DATA_URL} ni dosegljiv:`, err instanceof Error ? err.message : err);
      warned = true;
    }
  }
  return memory ? parseOsnovniPodatki(memory.json, date) : null;
}

/** Tests: forget the in-memory file. */
export function resetHozanaMemory(): void {
  memory = null;
  failedAt = 0;
  warned = false;
}
