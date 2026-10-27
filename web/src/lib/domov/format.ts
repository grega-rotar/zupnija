/** Wording helpers for Domov: Slovenian number forms, first names, "včeraj ob 19.42". */

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

const WD = ["nedelja", "ponedeljek", "torek", "sreda", "četrtek", "petek", "sobota"];
const WD_ACC = ["v nedeljo", "v ponedeljek", "v torek", "v sredo", "v četrtek", "v petek", "v soboto"];
const wdOf = (iso: string) => new Date(`${iso}T12:00:00Z`).getUTCDay();
const shift = (iso: string, n: number) => {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

/** "danes" / "jutri" / "sreda" (the prototype's fRel). */
export function relativeDay(iso: string, base: string): string {
  if (iso === base) return "danes";
  if (iso === shift(base, 1)) return "jutri";
  return WD[wdOf(iso)];
}

const ymd = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Ljubljana", year: "numeric", month: "2-digit", day: "2-digit" });
const hm = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Ljubljana", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });

/** When a change was sent: "danes ob 8.15", "včeraj ob 19.42", "v petek ob 9.10", "12. 10. ob 9.10". */
export function relativeStamp(at: Date, nowDate: Date): string {
  const day = ymd.format(at), base = ymd.format(nowDate);
  const [h, m] = hm.format(at).split(":");
  const time = `${Number(h)}.${m}`;
  if (day === base) return `danes ob ${time}`;
  if (day === shift(base, -1)) return `včeraj ob ${time}`;
  const diff = Math.round((Date.parse(`${base}T12:00:00Z`) - Date.parse(`${day}T12:00:00Z`)) / 86400000);
  if (diff > 1 && diff < 7) return `${WD_ACC[wdOf(day)]} ob ${time}`;
  return `${Number(day.slice(8))}. ${Number(day.slice(5, 7))}. ob ${time}`;
}
