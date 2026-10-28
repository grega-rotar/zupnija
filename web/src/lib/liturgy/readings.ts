/**
 * The day's readings from hozana.si's api.php (US-003, https://hozana.si/api).
 *
 * `api.php?kaj=bb&datum=d.m.llll&skofija=ljubljana&kljuc=…` returns one JSON
 * object for the day: `opis`, `teza_opis`, `vrstica` as in the free day file
 * (hozana.ts), and per reading a reference (`berilo1`, `berilo2`, `psalm`,
 * `evangelij`; `berilo2` is empty on weekdays) with `*_naslov` (the heading),
 * `*_napoved` ("Berilo iz knjige preroka Izaija") and `*_vsebina` (HTML).
 * The psalm has `odpev`, the Gospel `aleluja`. Errors come back as
 * `{ napaka: "…" }`, often with HTTP 200.
 *
 * A key allows 10 requests a day and hozana asks for backend use only, so
 * each date is fetched at most once a day: kept here in memory for 24 h and,
 * in Next, in the data cache (readings-data.ts). The parser is tolerant: any
 * field may be missing, empty, a number or plain text instead of HTML.
 */
import type { IsoDate } from "@/lib/dates";
import { DIOCESE } from "./hozana";

/** HOZANA_API_URL overrides it for local previews against a fixture server, never in production. */
export const HOZANA_API_URL = process.env.HOZANA_API_URL || "https://hozana.si/api.php";
const TTL = 24 * 60 * 60 * 1000;
const TIMEOUT = 4000;
/** After a failure, wait this long before asking again (a slow hozana must not hold every page for 4 s). */
const RETRY = 10 * 60 * 1000;

export type ReadingLabel = "Berilo" | "Prvo berilo" | "Drugo berilo" | "Psalm" | "Evangelij";

export type ReadingPart = {
  label: ReadingLabel;
  /** "Ef 2,19-22"; may be empty when hozana has the text but no reference. */
  ref: string;
  /** The passage heading: "Apostoli so temelj Cerkve". */
  title: string | null;
  /** "Berilo iz pisma apostola Pavla Efežanom". */
  intro: string | null;
  /** The psalm response, without quotes. */
  response: string | null;
  /** The verse before the Gospel, without the "Aleluja." around it. */
  acclamation: string | null;
  /** Paragraphs; a line break inside one (psalm verses) is "\n". */
  text: string[];
};

export type HozanaReadings = {
  title: string | null;
  rank: string | null;
  gospelLine: string | null;
  readings: ReadingPart[];
};

/** "2026-11-01" → "1.11.2026", the d.m.llll the API documents. */
export function apiDate(date: IsoDate): string {
  const [y, m, d] = date.split("-");
  return `${Number(d)}.${Number(m)}.${y}`;
}

export function readingsApiUrl(date: IsoDate, key: string, diocese = DIOCESE): string {
  const q = new URLSearchParams({ kaj: "bb", datum: apiDate(date), skofija: diocese, kljuc: key });
  return `${HOZANA_API_URL}?${q}`;
}

const ENTITIES: Record<string, string> = { nbsp: " ", amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", hellip: "…", ndash: "–", mdash: "—", raquo: "»", laquo: "«", bdquo: "„", ldquo: "“", rdquo: "”", lsquo: "‘", rsquo: "’" };

function decode(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === "#") {
      const n = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : Number(e.slice(1));
      return Number.isFinite(n) && n > 0 ? String.fromCodePoint(n) : m;
    }
    return ENTITIES[e.toLowerCase()] ?? m;
  });
}

/** hozana's HTML (or plain text) → paragraphs; `<br>` stays a line break inside one, an empty line or a block element starts the next. */
export function htmlToParagraphs(html: unknown): string[] {
  if (typeof html !== "string" || !html.trim()) return [];
  const marked = html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/?(p|div|h[1-6]|li|ul|ol|blockquote|section)\b[^>]*>/gi, "\n\n")
    .replace(/<[^>]*>/g, "");
  return decode(marked)
    .split(/\n[ \t ]*\n/)
    .map((p) =>
      p
        .split("\n")
        .map((l) => l.replace(/[ \t ]+/g, " ").trim())
        .filter(Boolean)
        .join("\n"),
    )
    .filter(Boolean);
}

/** A trimmed one-line string, or null. Numbers count (hozana's ids and ranks are sometimes numeric). */
function str(v: unknown): string | null {
  if (typeof v === "number") return String(v);
  if (typeof v !== "string") return null;
  const s = decode(v.replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim();
  return s || null;
}

const unquote = (s: string | null) => s?.replace(/^[»"„“]+|[«"“”]+$/g, "").trim() || null;
const unalleluia = (s: string | null) => s?.replace(/^aleluja[.,!]?\s*/i, "").replace(/\s*aleluja[.!]?$/i, "").trim() || null;

/** The readings in api.php's `kaj=bb` JSON; null for an error object or a day without any reading. */
export function parseHozanaBB(json: unknown): HozanaReadings | null {
  if (!json || typeof json !== "object" || Array.isArray(json)) return null;
  const o = json as Record<string, unknown>;
  if (o.napaka) return null;

  const part = (label: ReadingLabel, key: string, extra: Partial<ReadingPart> = {}): ReadingPart | null => {
    const ref = str(o[key]) ?? "";
    const text = htmlToParagraphs(o[`${key}_vsebina`]);
    if (!ref && !text.length) return null;
    return { label, ref, title: str(o[`${key}_naslov`]), intro: str(o[`${key}_napoved`]), response: null, acclamation: null, text, ...extra };
  };

  const second = part("Drugo berilo", "berilo2");
  const readings = [
    part(second ? "Prvo berilo" : "Berilo", "berilo1"),
    part("Psalm", "psalm", { response: unquote(str(o.odpev)) }),
    second,
    part("Evangelij", "evangelij", { acclamation: unalleluia(str(o.aleluja)) }),
  ].filter((x): x is ReadingPart => x !== null);
  if (!readings.length) return null;

  return { title: str(o.opis), rank: str(o.teza_opis), gospelLine: str(o.vrstica), readings };
}

const memory = new Map<IsoDate, { at: number; value: HozanaReadings }>();
const inflight = new Map<IsoDate, Promise<HozanaReadings | null>>();
let failedAt = 0;
let warned = false;
let warnedNoKey = false;

/**
 * The readings for `date`, or null without a key, when hozana answers with
 * an error, a non-2xx or takes longer than 4 s. Each date is asked for at
 * most once in 24 h; failures are logged once.
 */
export async function fetchReadings(date: IsoDate, { key = process.env.HOZANA_API_KEY, now = Date.now() }: { key?: string; now?: number } = {}): Promise<HozanaReadings | null> {
  if (!key) {
    if (!warnedNoKey) console.warn("[hozana] HOZANA_API_KEY ni nastavljen: berila so le povezava na hozana.si.");
    warnedNoKey = true;
    return null;
  }
  const hit = memory.get(date);
  if (hit && now - hit.at < TTL) return hit.value;
  if (now - failedAt < RETRY) return null;
  // Two pages asking for the same day at once share one request.
  let pending = inflight.get(date);
  if (!pending) {
    pending = request(date, key, now).finally(() => inflight.delete(date));
    inflight.set(date, pending);
  }
  return pending;
}

async function request(date: IsoDate, key: string, now: number): Promise<HozanaReadings | null> {
  try {
    const res = await fetch(readingsApiUrl(date, key), { cache: "no-store", signal: AbortSignal.timeout(TIMEOUT) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json: unknown = await res.json();
    const value = parseHozanaBB(json);
    if (!value) throw new Error(str((json as { napaka?: unknown } | null)?.napaka) ?? "odgovor brez beril");
    memory.set(date, { at: now, value });
    warned = false;
    return value;
  } catch (err) {
    failedAt = now;
    // Never log the URL: it carries the key.
    if (!warned) console.warn(`[hozana] berila za ${date} niso dosegljiva:`, err instanceof Error ? err.message : err);
    warned = true;
    return null;
  }
}

/** Tests: forget what was fetched. */
export function resetReadingsMemory(): void {
  memory.clear();
  inflight.clear();
  failedAt = 0;
  warned = false;
  warnedNoKey = false;
}
