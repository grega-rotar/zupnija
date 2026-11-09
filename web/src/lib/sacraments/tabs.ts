/**
 * The tabs of /zakramenti (ZUP-11, ZUP-12), in their fixed order: the six
 * sacraments, then Katehumenat and Pogreb, set apart. Each tab's `key` is its
 * URL hash (/zakramenti#krst) and the field name of its texts in the
 * sacramentsPage document. Client-safe: the editor's form is built from it.
 */
export type SacramentTab = {
  key: string;
  label: string;
  /** The heading of the first text ("Kaj je ta zakrament"). */
  about: string;
  /** Katehumenat and Pogreb are not sacraments: shown after a divider. */
  apart?: boolean;
};

export const ARRANGE_HEADING = "Kako se dogovorite v naši župniji";

export const SACRAMENT_TABS: readonly SacramentTab[] = [
  { key: "krst", label: "Sveti krst", about: "Kaj je ta zakrament" },
  { key: "obhajilo", label: "Prvo sveto obhajilo", about: "Kaj je ta zakrament" },
  { key: "birma", label: "Sveta birma", about: "Kaj je ta zakrament" },
  { key: "spoved", label: "Sveta spoved", about: "Kaj je ta zakrament" },
  { key: "zakon", label: "Sveti zakon", about: "Kaj je ta zakrament" },
  { key: "maziljenje", label: "Sveto bolniško maziljenje", about: "Kaj je ta zakrament" },
  { key: "katehumenat", label: "Katehumenat", about: "Kaj je katehumenat", apart: true },
  { key: "pogreb", label: "Pogreb", about: "Cerkveni pogreb", apart: true },
];

export const isTabKey = (v: string): boolean => SACRAMENT_TABS.some((t) => t.key === v);

/** The tab a URL hash opens ("#pogreb" → "pogreb"); the first tab for anything else. */
export function tabFromHash(hash: string): string {
  const key = decodeURIComponent(hash.replace(/^#/, "")).trim().toLowerCase();
  return isTabKey(key) ? key : SACRAMENT_TABS[0].key;
}

/** The retired sacrament documents' `kind` → their tab. */
const BY_KIND: Record<string, string> = {
  baptism: "krst",
  communion: "obhajilo",
  confirmation: "birma",
  confession: "spoved",
  marriage: "zakon",
  anointing: "maziljenje",
  funeral: "pogreb",
};

/** The old subpages' slugs (/zakramenti/<slug>, before ZUP-11) → their tab. */
const BY_OLD_SLUG: Record<string, string> = {
  krst: "krst",
  "prvo-sveto-obhajilo": "obhajilo",
  "sveta-birma": "birma",
  spoved: "spoved",
  poroka: "zakon",
  "bolnisko-maziljenje": "maziljenje",
  pogreb: "pogreb",
};

/**
 * Where an old /zakramenti/<slug> URL goes now: its tab ("/zakramenti#pogreb"),
 * by the slug or, for a slug renamed in the editor, by the old document's kind.
 * Anything else (the enquiry form /zakramenti/povprasevanje too) goes to the page.
 */
export function oldSacramentPath(slug: string, kind?: string | null): string {
  const tab = BY_OLD_SLUG[slug] ?? (kind ? BY_KIND[kind] : undefined) ?? (isTabKey(slug) ? slug : undefined);
  return tab ? `/zakramenti#${tab}` : "/zakramenti";
}
