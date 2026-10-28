/** Wording helpers for Domov: Slovenian number forms, first names, "včeraj ob 19.42". Dates go through src/lib/dates.ts. */
import { addDays, dateOf, formatTime, relativeDayLabel, timeOf, weekdayOf } from "@/lib/dates";

/** Slovenian number forms: 1 maša, 2 maši, 3 maše, 5 maš (the prototype's pl()). */
export function pl(n: number, f: readonly [string, string, string, string]): string {
  const k = n % 100;
  return `${n} ${f[k === 1 ? 0 : k === 2 ? 1 : k === 3 || k === 4 ? 2 : 3]}`;
}

export const MAS = ["maša", "maši", "maše", "maš"] as const;
export const NAMEN = ["namen", "namena", "nameni", "namenov"] as const;
export const OBVESTILO = ["obvestilo", "obvestili", "obvestila", "obvestil"] as const;
export const OTROK = ["otrok", "otroka", "otroci", "otrok"] as const;
export const SPREMEMBA_CAKA = ["sprememba čaka", "spremembi čakata", "spremembe čakajo", "sprememb čaka"] as const;
export const SPREMEMBA_JE = ["sprememba je", "spremembi sta", "spremembe so", "sprememb je"] as const;
export const URA_ODPADE = ["ura odpade", "uri odpadeta", "ure odpadejo", "ur odpade"] as const;

/** "msgr. dr. Blaž Jezeršek" → "Blaž", "Marta Zupan" → "Marta". */
export const firstName = (name: string) => name.replace(/^((msgr|dr|mag)\.\s*)+/, "").split(/\s+/)[0] || name;

const WD_ACC = { sunday: "v nedeljo", monday: "v ponedeljek", tuesday: "v torek", wednesday: "v sredo", thursday: "v četrtek", friday: "v petek", saturday: "v soboto" } as const;

/** "danes" / "jutri" / "sreda": the site's relativeDayLabel, in running text. */
export function relativeDay(iso: string, base: string): string {
  return relativeDayLabel(iso, base).toLowerCase();
}

/** When a change was sent: "danes ob 8.15", "včeraj ob 19.42", "v petek ob 9.10", "12. 10. ob 9.10". */
export function relativeStamp(at: Date, nowDate: Date): string {
  const iso = at.toISOString();
  const day = dateOf(iso), base = dateOf(nowDate.toISOString());
  const time = formatTime(timeOf(iso));
  if (day === base) return `danes ob ${time}`;
  if (day === addDays(base, -1)) return `včeraj ob ${time}`;
  if (day >= addDays(base, -6) && day < base) return `${WD_ACC[weekdayOf(day)]} ob ${time}`;
  return `${Number(day.slice(8))}. ${Number(day.slice(5, 7))}. ob ${time}`;
}
