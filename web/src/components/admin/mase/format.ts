/** Labels the Mass screens share, as in the prototype (no server imports: client-safe). */
import type { IntentionKind } from "@/lib/mase/format";
import type { MassView } from "@/lib/mase/queries";
import { MASS_TYPE_LABEL } from "@/lib/masses";

export { kindPrefix } from "@/lib/mase/format";

/** "18:30" → "18.30" (src/lib/dates.ts formatTime). */
export { formatTime as fT } from "@/lib/dates";

/** The intention kinds as chips. */
export const KINDS: ReadonlyArray<readonly [IntentionKind, string]> = [
  ["deceased", "† Za pokojne"],
  ["thanksgiving", "Zahvala"],
  ["other", "Za žive / drugo"],
];

/** The public site's labels ("Nedeljska sveta maša"), so rows read the same on both sides. */
const label = (t: MassView["type"]) => MASS_TYPE_LABEL[t] ?? MASS_TYPE_LABEL.regular;
export const typeShort = label;
export const typeLong = label;

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
