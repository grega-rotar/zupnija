/**
 * Group search on /zupnija/skupine (US-012): the query's words must all
 * appear in the group's name, summary, meeting time or place. Case and
 * Slovenian diacritics don't matter ("zbor", "Zbor", "cescenje" all find).
 */

/** Lower case without diacritics: "Češčenje" → "cescenje". */
export function fold(s: string): string {
  return s
    .normalize("NFD")
    .replace(/\p{M}+/gu, "")
    .toLowerCase();
}

type Searchable = { title?: string | null; summary?: string | null; meetingSchedule?: string | null; location?: string | null };

/** The text a group is found by. */
export function groupSearchText(g: Searchable): string {
  return fold([g.title, g.summary, g.meetingSchedule, g.location].filter(Boolean).join(" "));
}

/** Rows whose `text` (already folded) holds every word of `query`; all rows for an empty query. */
export function filterByQuery<R extends { text: string }>(rows: R[], query: string): R[] {
  const words = fold(query).split(/\s+/).filter(Boolean);
  if (!words.length) return rows;
  return rows.filter((r) => words.every((w) => r.text.includes(w)));
}

/** The `?q=` value as the field shows it: one trimmed string, at most 80 characters. */
export function queryParam(v: string | string[] | undefined): string {
  return (Array.isArray(v) ? v[0] : v ?? "").trim().slice(0, 80);
}
