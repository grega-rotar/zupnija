/**
 * Formatting for the oznanila screens: thin names over src/lib/dates.ts, so
 * the editor and the public site write dates the same way.
 * No server imports: the list (server) and the upload flow (client) share it.
 */
import { periodLabel, type BulletinFlag, type DraftEvent, type DraftIntention } from "@/lib/bulletin/types";
import { addDays, formatDayMonth, formatDayShort, formatMonthLong, formatTime, formatWeekdayShort, formatWeekSpan, WEEKDAY_LABEL, weekdayOf } from "@/lib/dates";

export const addDaysIso = addDays;

/** "18:30" → "18.30", "07:00" → "7.00". */
export const fT = formatTime;
/** "tor 3. nov" */
export const fDayS = formatDayShort;
/** "sre" */
export const fWd = formatWeekdayShort;
/** "Sreda" */
export const fWeekday = (iso: string) => {
  const w = WEEKDAY_LABEL[weekdayOf(iso)];
  return w.charAt(0).toUpperCase() + w.slice(1);
};
/** "14. oktober" */
export const fDayMonth = formatDayMonth;
/** "oktober" */
export const fMonth = formatMonthLong;
/** The days of a week clipped to the period: "1.–3. oktober", "4.–10. oktober". */
export const fSpan = (a: string, b: string) => formatWeekSpan(a, b);

/** Slovenian number forms: 1 namen, 2 namena, 3 nameni, 5 namenov. */
export const pl = (n: number, f: readonly [string, string, string, string]) => {
  const k = n % 100;
  return `${n} ${f[k === 1 ? 0 : k === 2 ? 1 : k === 3 || k === 4 ? 2 : 3]}`;
};
export const NAM = ["namen", "namena", "nameni", "namenov"] as const;
export const OBV = ["obvestilo", "obvestili", "obvestila", "obvestil"] as const;
export const SRE = ["srečanje", "srečanji", "srečanja", "srečanj"] as const;
export const MAS = ["maša", "maši", "maše", "maš"] as const;
/** "2 mesti za preveriti" */
export const toCheck = (n: number) => `${pl(n, ["mesto", "mesti", "mesta", "mest"])} za preveriti`;
/** "Najprej preverite 2 označeni mesti" (1: "označeno mesto") */
export const checkFirst = (n: number) =>
  `Najprej preverite ${n === 1 ? "označeno mesto" : pl(n, ["označeno mesto", "označeni mesti", "označena mesta", "označenih mest"])}`;

export const pre = (kind: string) => (kind === "deceased" ? "†" : "·");
export const KINDS = [
  ["deceased", "† Za pokojne"],
  ["thanksgiving", "Zahvala"],
  ["other", "Za žive / drugo"],
] as const;

/** "Fotografija · 412 KB", "PDF · 1,2 MB", "Tabela · 3 KB". */
export function fileMeta(mime: string, size: number): string {
  const s = size >= 1024 * 1024 ? `${(size / 1024 / 1024).toFixed(1).replace(".", ",")} MB` : `${Math.max(1, Math.round(size / 1024))} KB`;
  return `${fileKind(mime)} · ${s}`;
}
export const fileKind = (mime: string) => (mime.startsWith("image/") ? "Fotografija" : mime === "application/pdf" ? "PDF" : "Tabela");
/** Browsers can show these inline; HEIC mostly not. */
export const showsInline = (mime: string) => ["image/jpeg", "image/png", "image/webp", "image/gif"].includes(mime);

/** "HH:MM" from "17.30", "17:30", "7.00", "7"; null when it isn't a time. */
export function parseTime(v: string): string | null {
  const m = v.trim().match(/^(\d{1,2})(?:[:.](\d{2}))?$/);
  if (!m || Number(m[1]) > 23 || Number(m[2] ?? 0) > 59) return null;
  return `${m[1].padStart(2, "0")}:${m[2] ?? "00"}`;
}

/**
 * The chip label of a flag option. The schedule check (flags.ts) asks
 * "Na listu piše 17.30, po urniku je … ob 18.30": the sheet's own value reads
 * "17.30, kot piše", the scheduled one "18.30, po urniku".
 */
export function optionLabel(item: { time?: string }, flag: BulletinFlag, option: string, churchName: (slug: string) => string): string {
  if (flag.field === "time") {
    if (!/^\d{1,2}:\d{2}$/.test(option)) return option;
    if (!flag.question.startsWith("Na listu piše")) return fT(option);
    return `${fT(option)}, ${option === item.time ? "kot piše" : "po urniku"}`;
  }
  if (flag.field === "church") return churchName(option);
  if (flag.field === "date") return /^\d{4}-\d{2}-\d{2}$/.test(option) ? fDayS(option) : option;
  return option;
}

/** The intention as it will be published with this resolution. */
export function resolved<I extends DraftIntention & { date?: string }>(item: I, value: string | undefined): I {
  if (!item.flag || !value) return item;
  switch (item.flag.field) {
    case "text":
      return { ...item, text: value };
    case "time":
      return { ...item, time: parseTime(value) ?? item.time };
    case "date":
      return { ...item, date: value };
    case "church":
      return { ...item, churchSlug: value };
    default:
      return item;
  }
}

/**
 * The period in running text, whatever the bulletin covers (the backend's
 * periodLabel): a month reads "oktober 2026", a week or any other span
 * "1.–7. november 2026". The format of the oznanila may change, so nothing
 * here assumes a month.
 */
export const periodName = (p: { start: string; end: string }): string => periodLabel(p.start, p.end);

/** The event as it will be published with this resolution (mirrors lib/bulletin/actions resolveEvent). */
export function resolvedEvent(ev: DraftEvent, value: string | undefined): DraftEvent {
  if (!ev.include || !ev.flag || !value) return ev;
  switch (ev.flag.field) {
    case "time":
      return { ...ev, time: parseTime(value) ?? ev.time };
    case "date":
      return /^\d{4}-\d{2}-\d{2}$/.test(value) ? { ...ev, date: value } : ev;
    case "text":
      return { ...ev, title: value };
    default:
      return { ...ev, place: value };
  }
}

/** A notice the reader couldn't place (a format change): the backend starts it with "Ni razvrščeno:". */
const UNPLACED = /^\s*Ni razvrščeno:\s*/i;
export const isUnplaced = (text: string) => UNPLACED.test(text);
/** The notice without the "Ni razvrščeno:" prefix (kept as an ordinary notice). */
export const placed = (text: string) => text.replace(UNPLACED, "");

/** "sob 24. okt · 7.00 · Izpred Mihovca" */
export const eventWhen = (e: Pick<DraftEvent, "date" | "time" | "place">) => [fDayS(e.date), e.time ? fT(e.time) : null, e.place || null].filter(Boolean).join(" · ");
