/** The kinds a sacrament enquiry can be about (client-safe: the form's select uses them). */
export const SACRAMENT_KINDS = ["krst", "prvo_obhajilo", "birma", "poroka", "bolnisko_maziljenje", "pogreb", "drugo"] as const;
export type SacramentKind = (typeof SACRAMENT_KINDS)[number];

export const SACRAMENT_KIND_LABEL: Record<SacramentKind, string> = {
  krst: "Krst",
  prvo_obhajilo: "Prvo sveto obhajilo",
  birma: "Birma",
  poroka: "Poroka",
  bolnisko_maziljenje: "Bolniško maziljenje",
  pogreb: "Pogreb",
  drugo: "Drugo",
};

export const kindLabel = (k: string) => SACRAMENT_KIND_LABEL[k as SacramentKind] ?? k;

/** Kinds where someone may need a priest today: the form shows the emergency phone. */
export const URGENT_KINDS: SacramentKind[] = ["bolnisko_maziljenje", "pogreb"];

/** A sacrament page's `kind` (its document) → the enquiry kind it preselects. */
const FROM_DOC: Record<string, SacramentKind> = {
  baptism: "krst",
  communion: "prvo_obhajilo",
  confirmation: "birma",
  marriage: "poroka",
  anointing: "bolnisko_maziljenje",
  funeral: "pogreb",
};

export function enquiryKind(docKind: string | null | undefined, slug?: string | null): SacramentKind {
  if (docKind && FROM_DOC[docKind]) return FROM_DOC[docKind];
  const s = (slug ?? "").replace(/-/g, "_");
  return (SACRAMENT_KINDS as readonly string[]).includes(s) ? (s as SacramentKind) : "drugo";
}

export const isSacramentKind = (v: unknown): v is SacramentKind => typeof v === "string" && (SACRAMENT_KINDS as readonly string[]).includes(v);
