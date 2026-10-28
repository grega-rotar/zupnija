/**
 * Formatting for the oznanila screens: thin names over src/lib/dates.ts, so
 * the editor and the public site write dates the same way.
 * No server imports: the list (server) and the upload flow (client) share it.
 */
import type { BulletinFlag, BulletinItem } from "@/lib/bulletin/types";
import { addDays, formatDayShort, formatTime, formatWeekdayShort, formatWeekSpan } from "@/lib/dates";

export const addDaysIso = addDays;

/** "18:30" → "18.30", "07:00" → "7.00". */
export const fT = formatTime;
/** "tor 3. nov" */
export const fDayS = formatDayShort;
/** The bulletin week starting on Sunday `a`: "1.–7. november", across months "29. nov – 5. dec". */
export const fSpan = (a: string) => formatWeekSpan(a, addDays(a, 6));
/** "pon 2.11." as written on a sheet (the sheet's own notation, used only to echo the sheet). */
export const fSheetDay = (iso: string) => `${formatWeekdayShort(iso)} ${Number(iso.slice(8, 10))}.${Number(iso.slice(5, 7))}.`;

/** Slovenian number forms: 1 namen, 2 namena, 3 nameni, 5 namenov. */
export const pl = (n: number, f: readonly [string, string, string, string]) => {
  const k = n % 100;
  return `${n} ${f[k === 1 ? 0 : k === 2 ? 1 : k === 3 || k === 4 ? 2 : 3]}`;
};
export const NAM = ["namen", "namena", "nameni", "namenov"] as const;
export const OBV = ["obvestilo", "obvestili", "obvestila", "obvestil"] as const;
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
  const kind = mime.startsWith("image/") ? "Fotografija" : mime === "application/pdf" ? "PDF" : "Tabela";
  const s = size >= 1024 * 1024 ? `${(size / 1024 / 1024).toFixed(1).replace(".", ",")} MB` : `${Math.max(1, Math.round(size / 1024))} KB`;
  return `${kind} · ${s}`;
}
/** Browsers can show these inline; HEIC mostly not. */
export const showsInline = (mime: string) => ["image/jpeg", "image/png", "image/webp", "image/gif"].includes(mime);

/** "HH:MM" from "17.30", "17:30", "7.00"; null when it isn't a time. */
export function parseTime(v: string): string | null {
  const m = v.trim().match(/^(\d{1,2})[:.](\d{2})$/);
  if (!m || Number(m[1]) > 23 || Number(m[2]) > 59) return null;
  return `${m[1].padStart(2, "0")}:${m[2]}`;
}

/**
 * The chip label of a flag option. The schedule check (flags.ts) asks
 * "Na listu piše 17.30, po urniku je … ob 18.30": the sheet's own value reads
 * "17.30, kot piše", the scheduled one "18.30, po urniku".
 */
export function optionLabel(item: BulletinItem, flag: BulletinFlag, option: string, churchName: (slug: string) => string): string {
  if (flag.field === "time") {
    if (!/^\d{1,2}:\d{2}$/.test(option)) return option;
    if (!flag.question.startsWith("Na listu piše")) return fT(option);
    return `${fT(option)}, ${option === item.time ? "kot piše" : "po urniku"}`;
  }
  if (flag.field === "church") return churchName(option);
  if (flag.field === "date") return /^\d{4}-\d{2}-\d{2}$/.test(option) ? fDayS(option) : option;
  return option;
}

/** The item as it will be published with this resolution. */
export function resolved(item: BulletinItem, value: string | undefined): BulletinItem {
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
  }
}
