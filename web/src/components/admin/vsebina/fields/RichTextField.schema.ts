/*
 * Rich text rules, the same as the studio's blockContent / simpleBlockContent
 * (studio/schemaTypes/objects/blockContent.ts): what each variant allows, the
 * editor schema built from it, and the pure transforms that keep any value
 * (pasted from Word or the web, imported, or typed) inside those rules.
 *
 * No React and no editor runtime here, so the transforms are unit-tested
 * (RichTextField.schema.test.ts) and safe to call anywhere.
 */
import type { SchemaDefinition } from "@portabletext/editor";

export type RichTextVariant = "full" | "simple";

/** One Portable Text block as stored (Sanity JSON). Loose on purpose: input can be anything. */
export type PtBlock = { _type: string; _key: string; [k: string]: unknown };
export type PtSpan = { _type: "span"; _key: string; text: string; marks: string[] };
export type PtLink = { _type: "link"; _key: string; href: string };
export type PtTextBlock = {
  _type: "block";
  _key: string;
  style: string;
  markDefs: PtLink[];
  children: PtSpan[];
  listItem?: string;
  level?: number;
};

export const RULES = {
  full: {
    styles: ["normal", "h2", "h3", "blockquote"],
    lists: ["bullet", "number"],
    decorators: ["strong", "em"],
    objects: ["imageWithAlt", "attachment"],
  },
  simple: {
    styles: ["normal"],
    lists: ["bullet"],
    decorators: ["strong", "em"],
    objects: [],
  },
} as const satisfies Record<RichTextVariant, { styles: string[]; lists: string[]; decorators: string[]; objects: string[] }>;

const link = { name: "link", title: "Povezava", fields: [{ name: "href", type: "string" }] } as const;

/** The editor schemas: names and fields exactly as the studio stores them. */
export const SCHEMAS: Record<RichTextVariant, SchemaDefinition> = {
  full: {
    styles: [{ name: "normal" }, { name: "h2" }, { name: "h3" }, { name: "blockquote" }],
    lists: [{ name: "bullet" }, { name: "number" }],
    decorators: [{ name: "strong" }, { name: "em" }],
    annotations: [link],
    blockObjects: [
      {
        name: "imageWithAlt",
        title: "Slika",
        fields: [
          { name: "asset", type: "object" },
          { name: "alt", type: "string" },
          { name: "caption", type: "string" },
          { name: "hotspot", type: "object" },
          { name: "crop", type: "object" },
        ],
      },
      {
        name: "attachment",
        title: "Priponka",
        fields: [
          { name: "title", type: "string" },
          { name: "file", type: "object" },
        ],
      },
    ],
  },
  simple: {
    styles: [{ name: "normal" }],
    lists: [{ name: "bullet" }],
    decorators: [{ name: "strong" }, { name: "em" }],
    annotations: [link],
  },
};

/** Twelve hex characters, the shape of Sanity's own keys. */
export function newKey(): string {
  const bytes = new Uint8Array(6);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown) => (typeof v === "string" ? v : "");

/**
 * A link target the site may render: http(s), mailto, tel, or a path on the
 * site ("/novice/x", "#kontakt"). The studio's rule, plus no `javascript:`.
 * Returns the trimmed href, or null when it is not allowed.
 */
export function cleanHref(href: unknown): string | null {
  const h = str(href).trim();
  if (!h) return null;
  if (/^(https?:\/\/|mailto:|tel:)/i.test(h)) return h;
  if (/^[/#?]/.test(h) && !h.startsWith("//")) return h;
  // "www.example.si" or "example.si/pot": what people type; assume https.
  if (/^[\w-]+(\.[\w-]+)+(\/\S*)?$/.test(h) && !/\s/.test(h)) return `https://${h}`;
  return null;
}

function mapStyle(style: unknown, variant: RichTextVariant): string {
  const s = str(style);
  if (variant === "simple") return "normal";
  if ((RULES.full.styles as readonly string[]).includes(s)) return s;
  if (s === "h1") return "h2";
  if (/^h[4-6]$/.test(s)) return "h3";
  return "normal";
}

function mapList(listItem: unknown, variant: RichTextVariant): string | undefined {
  const l = str(listItem);
  if (!l) return undefined;
  const lists = RULES[variant].lists as readonly string[];
  if (lists.includes(l)) return l;
  return lists.includes("bullet") ? "bullet" : undefined;
}

function cleanTextBlock(b: Record<string, unknown>, variant: RichTextVariant, key: () => string): PtTextBlock {
  const decorators = RULES[variant].decorators as readonly string[];
  const markDefs: PtLink[] = [];
  for (const d of Array.isArray(b.markDefs) ? b.markDefs : []) {
    if (!isObj(d) || d._type !== "link") continue;
    const href = cleanHref(d.href);
    if (href) markDefs.push({ _type: "link", _key: str(d._key) || key(), href });
  }
  const linkKeys = new Set(markDefs.map((d) => d._key));

  const children: PtSpan[] = [];
  for (const c of Array.isArray(b.children) ? b.children : []) {
    if (!isObj(c) || c._type !== "span") continue; // inline objects are not in either schema
    const marks = (Array.isArray(c.marks) ? c.marks : [])
      .filter((m): m is string => typeof m === "string" && (decorators.includes(m) || linkKeys.has(m)));
    const span: PtSpan = { _type: "span", _key: str(c._key) || key(), text: str(c.text), marks: [...new Set(marks)] };
    const prev = children.at(-1);
    // Word and web pages split text into many spans with the same marks; join them.
    if (prev && sameMarks(prev.marks, span.marks)) prev.text += span.text;
    else children.push(span);
  }
  if (!children.length) children.push({ _type: "span", _key: key(), text: "", marks: [] });

  // Only links some span still uses.
  const used = new Set(children.flatMap((c) => c.marks));
  const block: PtTextBlock = {
    _type: "block",
    _key: str(b._key) || key(),
    style: mapStyle(b.style, variant),
    markDefs: markDefs.filter((d) => used.has(d._key)),
    children,
  };
  const listItem = mapList(b.listItem, variant);
  if (listItem) {
    block.listItem = listItem;
    const level = Number(b.level);
    block.level = Number.isInteger(level) && level >= 1 ? Math.min(level, variant === "simple" ? 1 : 3) : 1;
    // A heading or quote cannot be a list item on the site.
    block.style = "normal";
  }
  return block;
}

function sameMarks(a: string[], b: string[]) {
  return a.length === b.length && a.every((m) => b.includes(m));
}

const ref = (v: unknown) => (isObj(v) && typeof v._ref === "string" && v._ref ? { _type: "reference", _ref: v._ref } : null);

function cleanObject(b: Record<string, unknown>, variant: RichTextVariant, key: () => string): PtBlock | null {
  if (variant === "simple") return null;
  const _key = str(b._key) || key();
  if (b._type === "imageWithAlt" || b._type === "image") {
    const asset = ref(b.asset);
    if (!asset) return null;
    const out: PtBlock = { _type: "imageWithAlt", _key, asset };
    if (str(b.alt)) out.alt = str(b.alt);
    if (str(b.caption)) out.caption = str(b.caption);
    if (isObj(b.hotspot)) out.hotspot = b.hotspot;
    if (isObj(b.crop)) out.crop = b.crop;
    return out;
  }
  if (b._type === "attachment") {
    const asset = isObj(b.file) ? ref(b.file.asset) : null;
    if (!asset) return null;
    return { _type: "attachment", _key, title: str(b.title), file: { _type: "file", asset } };
  }
  return null;
}

/**
 * Keeps a Portable Text value inside the variant's rules:
 * - styles: h1 → h2, h4–h6 → h3, anything else → normal ("simple": all normal);
 * - lists: unknown → bullet, levels 1–3 ("simple": bullet, level 1);
 * - marks: only strong, em and links with an allowed href; unused markDefs go;
 * - adjacent spans with the same marks are joined; every block has a span;
 * - objects: imageWithAlt and attachment with an uploaded asset ("full" only);
 *   anything else (tables, inline objects, code …) is dropped;
 * - every block, span and link has a _key.
 * Idempotent: cleaning a clean value returns an equal value.
 */
export function sanitizePortableText(value: unknown, variant: RichTextVariant, key: () => string = newKey): PtBlock[] {
  if (!Array.isArray(value)) return [];
  const out: PtBlock[] = [];
  const seen = new Set<string>();
  for (const b of value) {
    if (!isObj(b)) continue;
    const clean = b._type === "block" ? (cleanTextBlock(b, variant, key) as unknown as PtBlock) : cleanObject(b, variant, key);
    if (!clean) continue;
    // Pasting the same fragment twice must not leave duplicate keys.
    if (seen.has(clean._key)) clean._key = key();
    seen.add(clean._key);
    out.push(clean);
  }
  return out;
}

/** True when the value has no text and no objects (store null/[] instead of an empty paragraph). */
export function isEmptyPortableText(value: unknown): boolean {
  if (!Array.isArray(value) || value.length === 0) return true;
  return value.every(
    (b) =>
      isObj(b) &&
      b._type === "block" &&
      (!Array.isArray(b.children) || b.children.every((c) => isObj(c) && c._type === "span" && !str(c.text).trim())),
  );
}

/**
 * Light HTML clean-up before the editor's own HTML importer runs (it already
 * understands Word, Word Online and Google Docs lists and bold/italic):
 * - the bullets Word types out in its list fallback markup ("·", "1.") go,
 *   so list items do not start with a stray bullet;
 * - "full": headings the site does not have become the nearest one it has,
 *   so a Word "Naslov 1" stays a heading instead of dropping to a paragraph.
 */
export function preparePastedHtml(html: string, variant: RichTextVariant): string {
  const out = html
    .replace(/<!\[if !supportLists\]>[\s\S]*?<!\[endif\]>/gi, "")
    .replace(/<span[^>]*mso-list:\s*Ignore[^>]*>(?:[^<]|<(?!\/?span)|<span[^>]*>[^<]*<\/span>)*<\/span>/gi, "");
  if (variant === "simple") return out;
  return out
    .replace(/<(\/?)h1(?=[\s>])/gi, "<$1h2")
    .replace(/<(\/?)h[4-6](?=[\s>])/gi, "<$1h3")
    // Word's own title paragraph style.
    .replace(/<p(\s[^>]*class=["']?MsoTitle[^>]*)>([\s\S]*?)<\/p>/gi, "<h2$1>$2</h2>");
}
