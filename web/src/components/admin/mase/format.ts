/** Labels the Mass screens share, as in the prototype (no server imports: client-safe). */
import type { IntentionKind } from "@/lib/mase/format";
import type { MassView } from "@/lib/mase/queries";

export { kindPrefix } from "@/lib/mase/format";

/** "18:30" → "18.30" */
export const fT = (t: string) => `${Number(t.slice(0, 2))}.${t.slice(3, 5)}`;

/** The intention kinds as chips. */
export const KINDS: ReadonlyArray<readonly [IntentionKind, string]> = [
  ["deceased", "† Za pokojne"],
  ["thanksgiving", "Zahvala"],
  ["other", "Za žive / drugo"],
];

/** Row label ("Nedeljska maša") and panel subtitle ("Nedeljska sveta maša"). */
const TYPE: Record<MassView["type"], readonly [string, string]> = {
  regular: ["Sveta maša", "Sveta maša"],
  sunday: ["Nedeljska maša", "Nedeljska sveta maša"],
  family: ["Družinska maša", "Družinska sveta maša"],
  children: ["Otroška maša", "Otroška sveta maša"],
  youth: ["Mladinska maša", "Mladinska sveta maša"],
  evening: ["Večerna maša", "Večerna sveta maša"],
};
export const typeShort = (t: MassView["type"]) => TYPE[t]?.[0] ?? "Sveta maša";
export const typeLong = (t: MassView["type"]) => TYPE[t]?.[1] ?? "Sveta maša";

/** "Marta Zupan" → "Marta", "msgr. dr. Blaž Jezeršek" → "Blaž". */
export const firstName = (name: string) => name.split(" ").slice(-2, -1)[0] || name;

/** Slovenian plural with the dual: pl(2, ["maša", "maši", "maše", "maš"]) → "2 maši". */
export function pl(n: number, f: readonly [string, string, string, string]): string {
  const k = n % 100;
  return `${n} ${f[k === 1 ? 0 : k === 2 ? 1 : k === 3 || k === 4 ? 2 : 3]}`;
}
export const MAS = ["maša", "maši", "maše", "maš"] as const;

/** "ta teden", "naslednji teden", "čez dva tedna", "čez 3 tedne", "čez 5 tednov". */
export function weekWord(offset: number): string {
  if (offset <= 0) return "ta teden";
  if (offset === 1) return "naslednji teden";
  if (offset === 2) return "čez dva tedna";
  if (offset <= 4) return `čez ${offset} tedne`;
  return `čez ${offset} tednov`;
}
