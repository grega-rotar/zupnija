/**
 * Plain helpers for the generic content form (no React): field paths, new
 * array keys, a "changed?" check, list search, and the per-field check the
 * form runs before it saves. The check is the server's own
 * (lib/content/schemas.ts, derived from lib/content/fields.ts), so the
 * person sees each problem next to its field before anything is sent.
 */
import type { Doc, TypeDef } from "@/lib/content/fields";
import { validateContent } from "@/lib/content/schemas";

export type Path = Array<string | number>;
export type Errors = Record<string, string>;

export const pathKey = (p: Path) => p.join(".");

/** A Sanity-style array item key. */
export function newKey(): string {
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** JSON with sorted keys, so key order never counts as a change. */
export function stableJson(v: unknown): string {
  return JSON.stringify(v, (_k, val: unknown) =>
    val && typeof val === "object" && !Array.isArray(val)
      ? Object.fromEntries(Object.entries(val as Record<string, unknown>).sort(([a], [b]) => (a < b ? -1 : 1)))
      : val,
  );
}

export const sameDoc = (a: unknown, b: unknown) => stableJson(a) === stableJson(b);

/** Every problem in `doc`, keyed by field path ("title", "address.city", "sections.2.body"): the server's own check (lib/content/schemas.ts). */
export function validateDoc(def: TypeDef, doc: Doc): Errors {
  const errors: Errors = {};
  for (const i of validateContent(def.type, doc)) errors[pathKey(i.path)] ??= i.message;
  return errors;
}

/** List rows matching a search: every word must appear in the title or the subtitle. */
export function filterRows<R extends { title: string; subtitle: string }>(rows: R[], q: string): R[] {
  const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return rows;
  return rows.filter((r) => {
    const hay = `${r.title} ${r.subtitle}`.toLowerCase();
    return words.every((w) => hay.includes(w));
  });
}

/** Where to put a message the server sent without a path. */
export function serverErrorPath(def: TypeDef, message: string): string | null {
  if (/naslov že obstaja/i.test(message) && def.fields.some((f) => f.kind === "slug")) return "slug";
  return null;
}
