/**
 * Zod schemas for website documents, derived from the field definitions in
 * lib/content/fields.ts (one source for the form and the validation). The
 * messages are the form's own (components/admin/vsebina/doc.ts), so the
 * server says the same thing the form would have said next to the field.
 *
 * Documents are Sanity JSON: objects keep keys the form doesn't know
 * (`_key`, `_type`, hotspot, crop, fields from Studio days …), only the
 * defined fields are checked. A field hidden by `when` is never required.
 */
import { z } from "zod";
import { CONTENT_TYPES, isShown, TYPES, type ArrayItem, type ContentType, type Field } from "./fields";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const URL_RE = /^(https?:\/\/[^\s.]+\.[^\s]+|https?:\/\/localhost\S*|mailto:\S+|tel:\S+)$/;
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^([01]?\d|2[0-3]):[0-5]\d$/;

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => !!v && typeof v === "object" && !Array.isArray(v);

function requiredMessage(f: Field): string {
  switch (f.kind) {
    case "select":
    case "reference":
      return "Izberite eno možnost.";
    case "image":
      return "Dodajte sliko.";
    case "images":
      return "Dodajte vsaj eno fotografijo.";
    case "file":
      return "Dodajte datoteko.";
    case "richText":
      return "Napišite besedilo.";
    case "slug":
      return "Vpišite spletni naslov.";
    case "date":
    case "datetime":
    case "time":
      return "Izberite datum.";
    default:
      return "To polje je obvezno.";
  }
}

/** Nothing worth storing (the form's rule): null, blank text, an empty list, no asset, rich text without text. */
export function isEmpty(f: Field, v: unknown): boolean {
  if (v == null) return true;
  if (typeof v === "string") return v.trim() === "";
  if (Array.isArray(v)) {
    if (f.kind !== "richText") return v.length === 0;
    return !v.some((b) => !isObj(b) || b._type !== "block" || (Array.isArray(b.children) && b.children.some((c) => isObj(c) && String(c.text ?? "").trim() !== "")));
  }
  if (f.kind === "image" || f.kind === "file") return !(isObj(v) && isObj(v.asset) && v.asset._ref);
  if (f.kind === "slug") return !(isObj(v) && String(v.current ?? "").trim());
  if (f.kind === "reference" && !f.many) return !(isObj(v) && v._ref);
  return false;
}

type Issue = { path: (string | number)[]; message: string };

const ref = (v: unknown) => isObj(v) && typeof v._ref === "string" && v._ref !== "";
const assetRef = (v: unknown, prefix: string) => isObj(v) && isObj(v.asset) && typeof v.asset._ref === "string" && v.asset._ref.startsWith(prefix);
const imageItem = (v: unknown) => assetRef(v, "image-");

/** Problems with one non-empty value. */
function checkValue(f: Field, v: unknown, parent: Obj, path: (string | number)[], out: Issue[]): void {
  const bad = (message: string, at = path): void => {
    out.push({ path: at, message });
  };
  switch (f.kind) {
    case "string":
    case "text": {
      if (typeof v !== "string") return bad("Vpišite besedilo.");
      if (f.max && v.length > f.max) return bad(`Največ ${f.max} znakov (zdaj ${v.length}).`);
      if (f.kind === "string") {
        if (f.format === "email" && !EMAIL.test(v.trim())) return bad(f.patternMessage ?? "Vnesite veljaven e-poštni naslov.");
        if (f.format === "url" && !URL_RE.test(v.trim())) return bad("Vnesite celoten spletni naslov, z https://.");
        if (f.pattern && !f.pattern.test(v.trim())) return bad(f.patternMessage ?? "Neveljavna oblika.");
      }
      return;
    }
    case "slug": {
      const s = isObj(v) && typeof v.current === "string" ? v.current : "";
      if (!SLUG.test(s)) return bad("Samo male črke brez šumnikov, številke in vezaji.");
      if (f.max && s.length > f.max) return bad(`Največ ${f.max} znakov.`);
      return;
    }
    case "number": {
      const n = typeof v === "number" ? v : NaN;
      if (!Number.isFinite(n)) return bad("Vpišite število.");
      if (f.min != null && n < f.min) return bad(`Najmanj ${f.min}.`);
      if (f.max != null && n > f.max) return bad(`Največ ${f.max}.`);
      return;
    }
    case "boolean":
      if (typeof v !== "boolean") bad("Neveljavna vrednost.");
      return;
    case "date":
    case "datetime":
    case "time": {
      const ok =
        typeof v === "string" &&
        (f.kind === "date" ? DATE.test(v) : f.kind === "time" ? TIME.test(v) : !Number.isNaN(Date.parse(v)) && /^\d{4}-\d{2}-\d{2}T/.test(v));
      if (!ok) return bad(f.kind === "time" ? "Vpišite uro v obliki 16:00." : "Izberite datum.");
      const from = f.kind !== "time" && f.after ? parent[f.after] : undefined;
      if (typeof from === "string" && from && (v as string) < from) return bad("Datum »do« mora biti po datumu »od«.");
      return;
    }
    case "select":
      if (!f.options.some((o) => o.value === v)) bad("Izberite eno možnost.");
      return;
    case "image":
      if (!imageItem(v)) bad("Dodajte sliko.");
      return;
    case "file":
      if (!assetRef(v, "file-") && !assetRef(v, "image-")) bad("Dodajte datoteko.");
      return;
    case "richText":
      if (!Array.isArray(v) || !v.every((b) => isObj(b) && typeof b._type === "string")) bad("Neveljavno besedilo.");
      return;
    case "reference":
      if (f.many) {
        if (!Array.isArray(v) || !v.every(ref)) return bad("Izberite eno možnost.");
        if (f.min && v.length < f.min) return bad(`Izberite vsaj ${f.min}.`);
      } else if (!ref(v)) bad("Izberite eno možnost.");
      return;
    case "object":
      if (!isObj(v)) return bad("Neveljavna vrednost.");
      checkFields(f.fields, v, path, out);
      return;
    case "array": {
      if (!Array.isArray(v)) return bad("Neveljavna vrednost.");
      if (f.min && v.length < f.min) return bad(f.minMessage ?? `Dodajte vsaj ${f.min}.`);
      if (f.max && v.length > f.max) return bad(`Največ ${f.max}.`);
      v.forEach((item, i) => {
        const of: ArrayItem | undefined = isObj(item) ? (f.of.find((o) => o.type === item._type) ?? (f.of.length === 1 ? f.of[0] : undefined)) : undefined;
        if (!isObj(item) || !of) return bad("Neveljavna vrednost.", [...path, i]);
        checkFields(of.fields, item, [...path, i], out);
      });
      return;
    }
    case "strings":
      if (!Array.isArray(v) || !v.every((s) => typeof s === "string")) bad("Neveljavna vrednost.");
      return;
    case "images":
      if (!Array.isArray(v) || !v.every(imageItem)) return bad("Dodajte sliko.");
      if (f.min && v.length < f.min) return bad(f.minMessage ?? `Dodajte vsaj ${f.min}.`);
      return;
    case "geopoint":
      if (!isObj(v) || typeof v.lat !== "number" || typeof v.lng !== "number") bad("Neveljavna lokacija.");
      return;
  }
}

function checkFields(fields: Field[], parent: Obj, at: (string | number)[], out: Issue[]): void {
  for (const f of fields) {
    if (!isShown(f, parent)) continue;
    const v = parent[f.name];
    const path = [...at, f.name];
    if (isEmpty(f, v)) {
      if ("required" in f && f.required) out.push({ path, message: requiredMessage(f) });
      continue;
    }
    checkValue(f, v, parent, path, out);
  }
}

/** Every problem in a document of this type, keyed by path ("title", "sections.2.body"). */
export function validateContent(type: ContentType, data: Obj): Issue[] {
  const out: Issue[] = [];
  checkFields(TYPES[type].fields, data, [], out);
  return out;
}

/** The zod schema for one type's document (the whole Sanity JSON, unknown keys kept). */
export function docSchema(type: ContentType) {
  return z.looseObject({}).superRefine((data, ctx) => {
    for (const issue of validateContent(type, data)) ctx.addIssue({ code: "custom", path: issue.path, message: issue.message });
  });
}

export const SCHEMAS = Object.fromEntries(CONTENT_TYPES.map((t) => [t, docSchema(t)])) as Record<ContentType, ReturnType<typeof docSchema>>;

export const contentType = z.enum(CONTENT_TYPES, { error: "Neznana vrsta vsebine." });
export const contentId = z.string().trim().min(1).max(200);

/** content.save: the document is checked against its type's schema. */
export const saveSchema = z
  .object({ id: contentId.optional(), type: contentType, data: z.looseObject({}) })
  .superRefine((p, ctx) => {
    const r = SCHEMAS[p.type].safeParse(p.data);
    if (!r.success) for (const i of r.error.issues) ctx.addIssue({ code: "custom", path: ["data", ...i.path], message: i.message });
  });

export const deleteSchema = z.object({ id: contentId });
export const reorderSchema = z.object({ type: contentType, ids: z.array(contentId).min(1).max(500) });
export const publishSchema = z.object({ id: contentId, published: z.boolean() });
