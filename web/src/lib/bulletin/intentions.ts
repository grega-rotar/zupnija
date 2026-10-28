/**
 * The bulletin's intention notation, normalised on the server so the kind
 * doesn't depend on the model (contract "Intention notation"):
 *
 *   "+ Jože Novak, obl."        → deceased, "Jože Novak, obl."
 *   "++ iz družin Juvan in K."  → deceased, "iz družin Juvan in K."
 *   "+ Lucija in + Andrejka S." → deceased, "Lucija in Andrejka S."   (one intention)
 *   "† Ana Kos" (handwritten)   → deceased, "Ana Kos"
 *   "V zahvalo …"               → thanksgiving
 *   "Za farane", "Po namenu", "Za zdravje", "Za Božje varstvo in blagoslov",
 *   "Na čast Svetemu Duhu", …   → other
 *
 * "obl." and "30. dan" stay in the text. Pure; no server imports.
 */
import type { IntentionKind } from "./types";

/** +, ++, † and ✝ markers (with the spaces after them), wherever they stand. */
const MARKERS = /(^|\s|\()(?:\+\s*)+|[†✝]\s*/g;

const OTHER = /^(za farane|za žive in rajne|po namenu|za zdravje|za božje varstvo|na čast|v čast|za duhovne poklice|za domovino|za mir|za blagoslov|za srečen|za uspeh|za spreobrnjenje|za verne duše)/i;

/** The text without +/++/† markers, trimmed, without a trailing full stop. */
export function stripMarkers(line: string): string {
  return line
    .replace(MARKERS, (_, pre: string | undefined) => pre ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/(?<!\b(?:obl|br|sv|dr|st))\.$/i, "")
    .trim();
}

export function hasDeceasedMarker(line: string): boolean {
  return /(^|\s|\()\+|[†✝]/.test(line);
}

/** Kind from the notation; `modelKind` only decides what the notation doesn't. */
export function intentionKind(line: string, modelKind?: IntentionKind): IntentionKind {
  if (hasDeceasedMarker(line)) return "deceased";
  const text = stripMarkers(line);
  if (/^v zahvalo/i.test(text)) return "thanksgiving";
  if (OTHER.test(text)) return "other";
  return modelKind ?? "other";
}

/** Text and kind of one printed intention. */
export function normaliseIntention(line: string, modelKind?: IntentionKind): { text: string; kind: IntentionKind } {
  return { text: stripMarkers(line).slice(0, 200), kind: intentionKind(line, modelKind) };
}

/** Key for "the same intention" when publishing again (dedupe): case, markers, spaces and punctuation ignored. */
export function intentionKey(text: string): string {
  return stripMarkers(text)
    .toLowerCase()
    .normalize("NFC")
    .replace(/[.,;:!?»«"']/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
