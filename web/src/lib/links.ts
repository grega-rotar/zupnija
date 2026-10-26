import { pathForDocument } from "./routes";

/** Shape of the `link` object as returned by `linkFragment`. */
export type ResolvedLink = {
  label?: string | null;
  kind?: string | null;
  href?: string | null;
  internal?: { _type: string; slug?: string | null; title?: string | null; name?: string | null } | null;
};

/** Turns a Sanity `link` object into an href, or null when it cannot be resolved. */
export function hrefFor(link: ResolvedLink | null | undefined): string | null {
  if (!link) return null;
  if (link.kind === "external") return link.href || null;
  if (link.internal) return pathForDocument(link.internal._type, link.internal.slug);
  return link.href || null;
}

export function isExternalHref(href: string): boolean {
  return /^(https?:)?\/\//.test(href) || href.startsWith("mailto:") || href.startsWith("tel:");
}

/** Strip spaces etc. for a tel: link. */
export function telHref(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, "")}`;
}
