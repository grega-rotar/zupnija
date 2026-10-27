/**
 * Formatting for the oznanila screens, as in the prototype (fDayS, fT, pl).
 * No server imports: the list (server) and the upload flow (client) share it.
 */
import type { BulletinFlag, BulletinItem } from "@/lib/bulletin/types";

const WD_S = ["ned", "pon", "tor", "sre", "čet", "pet", "sob"];
const MON = ["januar", "februar", "marec", "april", "maj", "junij", "julij", "avgust", "september", "oktober", "november", "december"];
const MON_S = ["jan", "feb", "mar", "apr", "maj", "jun", "jul", "avg", "sep", "okt", "nov", "dec"];

export const addDaysIso = (iso: string, n: number) => {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const wd = (iso: string) => new Date(`${iso}T12:00:00Z`).getUTCDay();
const dnum = (iso: string) => Number(iso.slice(8, 10));
const mon = (iso: string) => MON[Number(iso.slice(5, 7)) - 1];
const monS = (iso: string) => MON_S[Number(iso.slice(5, 7)) - 1];

/** "18:30" → "18.30", "07:00" → "7.00". */
export const fT = (t: string) => `${Number(t.slice(0, 2))}.${t.slice(3, 5)}`;
/** "tor 3. nov." */
export const fDayS = (iso: string) => `${WD_S[wd(iso)]} ${dnum(iso)}. ${monS(iso)}.`;
/** "2.–8. november", across months "26. okt – 1. nov". */
export const fSpan = (a: string) => {
  const b = addDaysIso(a, 6);
  return mon(a) === mon(b) ? `${dnum(a)}.–${dnum(b)}. ${mon(b)}` : `${dnum(a)}. ${monS(a)} – ${dnum(b)}. ${monS(b)}`;
};
/** "pon 2.11." as written on a sheet. */
export const fSheetDay = (iso: string) => `${WD_S[wd(iso)]} ${dnum(iso)}.${Number(iso.slice(5, 7))}.`;

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
