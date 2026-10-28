/**
 * Website content in the editor (areas "vsebina" and "zupnija"; settings is
 * owner-only, like "ljudje"). Contract: tasks/contract-content.md.
 *
 *   content.save     { id?, type, data }   create (new uuid; singletons use the type) or replace
 *   content.delete   { id }                owner only, never queued; refused while referenced
 *   content.reorder  { type, ids }         sets `sort` (and the doc's `order` field when it has one)
 *   content.publish  { id, published }     show on / hide from the website
 *
 * Documents are stored as Sanity JSON (`content.data`), validated by the
 * type's schema (lib/content/schemas.ts, derived from fields.ts). Every write
 * goes through the Tracker, so history and undo work as for everything else.
 * The public site reads `content` through lib/content/read.ts, cached under
 * the tag "content".
 */
import "server-only";
import { randomUUID } from "node:crypto";
import { and, eq, max, ne } from "drizzle-orm";
import { schema, type Tx } from "@/db";
import { defineAction } from "@/lib/admin/engine";
import { ForbiddenError, UserError } from "@/lib/admin/errors";
import type { Area } from "@/lib/admin/sections";
import { now } from "@/lib/clock";
import { titleOf, TYPES, type ContentType, type Doc } from "./fields";
import { deleteSchema, publishSchema, reorderSchema, saveSchema } from "./schemas";

const c = schema.content;
const TAGS = ["content"];

/** The editor area a type belongs to ("owner" types are owner-only, like "ljudje"). */
export function areaOfType(type: ContentType): Area {
  const a = TYPES[type].area;
  return a === "owner" ? "ljudje" : a;
}

const GONE = "Ta vnos ne obstaja več.";

async function loadRow(tx: Tx, id: string) {
  const [row] = await tx.select().from(c).where(eq(c.id, id));
  return row ?? null;
}

async function areaOfId(tx: Tx, id: string): Promise<Area> {
  const row = await loadRow(tx, id);
  if (!row || !(row.type in TYPES)) throw new UserError(GONE);
  return areaOfType(row.type as ContentType);
}

/** Sanity system fields that never belong in `data`. */
const SYSTEM = ["_rev", "_createdAt", "_updatedAt", "_system"];

function cleanDoc(id: string, type: ContentType, data: Doc): Doc {
  const out: Doc = { ...data, _id: id, _type: type };
  for (const k of SYSTEM) delete out[k];
  return out;
}

const slugOf = (data: Doc): string | null => {
  const s = (data.slug as { current?: unknown } | undefined)?.current;
  return typeof s === "string" && s.trim() ? s.trim() : null;
};

const titleFor = (type: ContentType, data: Doc) => titleOf(TYPES[type], data);
const hasOrderField = (type: ContentType) => TYPES[type].fields.some((f) => f.name === "order" && f.kind === "number");

/** The id a save writes: the given one, the type for a singleton, else a new uuid (on apply). */
const fixedId = (p: { id?: string; type: ContentType }) => p.id ?? (TYPES[p.type].singleton ? p.type : undefined);

// ── content.save ────────────────────────────────────────────────────────────
type SavePayload = { id?: string; type: ContentType; data: Doc };

export const saveAction = defineAction<SavePayload>({
  name: "content.save",
  area: (p) => areaOfType(p.type),
  schema: saveSchema as never,
  approvable: true,
  label: (p) => `${p.id ? "Sprememba" : "Novo"}: ${titleFor(p.type, p.data)}`,
  async check(p, tx) {
    const id = fixedId(p);
    if (p.id) {
      const row = await loadRow(tx, p.id);
      if (!row) throw new UserError(GONE);
      if (row.type !== p.type) throw new UserError("Neveljavni podatki.");
    }
    const slug = slugOf(p.data);
    if (slug) {
      const same = await tx
        .select({ id: c.id })
        .from(c)
        .where(and(eq(c.type, p.type), eq(c.slug, slug), id ? ne(c.id, id) : undefined));
      if (same.length) throw new UserError("Ta naslov že obstaja. Izberite drug spletni naslov.");
    }
  },
  async apply(p, { track, tx, requestedBy }) {
    const id = fixedId(p) ?? randomUUID();
    const data = cleanDoc(id, p.type, p.data);
    const slug = slugOf(data);
    const order = hasOrderField(p.type) && Number.isInteger(data.order) ? (data.order as number) : undefined;
    const existing = await loadRow(tx, id);
    if (existing) {
      await track.update("content", id, { data, slug, ...(order !== undefined ? { sort: order } : {}) });
    } else {
      let sort = order;
      if (sort === undefined && TYPES[p.type].orderable) {
        const [{ top }] = await tx.select({ top: max(c.sort) }).from(c).where(eq(c.type, p.type));
        sort = (top ?? 0) + 1;
      }
      const at = now();
      await track.insert("content", { id, type: p.type, slug, data, published: true, sort: sort ?? 0, createdBy: requestedBy, createdAt: at, updatedAt: at });
    }
    return { id };
  },
  tags: TAGS,
});

// ── content.delete ──────────────────────────────────────────────────────────
/** Titles of the documents that reference `id` anywhere. */
async function referencedBy(tx: Tx, id: string): Promise<string[]> {
  const rows = await tx.select({ id: c.id, type: c.type, data: c.data }).from(c).where(ne(c.id, id));
  const mentions = (v: unknown): boolean =>
    Array.isArray(v) ? v.some(mentions) : v && typeof v === "object" ? (v as Doc)._ref === id || Object.values(v).some(mentions) : false;
  return rows.filter((r) => mentions(r.data)).map((r) => (r.type in TYPES ? titleFor(r.type as ContentType, r.data) : r.id));
}

export const deleteAction = defineAction<{ id: string }>({
  name: "content.delete",
  area: (p, tx) => areaOfId(tx, p.id),
  schema: deleteSchema,
  approvable: false,
  label: async (p, tx) => {
    const row = await loadRow(tx, p.id);
    return `Izbrisano: ${row && row.type in TYPES ? titleFor(row.type as ContentType, row.data) : p.id}`;
  },
  async check(p, tx) {
    const row = await loadRow(tx, p.id);
    if (!row) throw new UserError(GONE);
    if (row.type in TYPES && TYPES[row.type as ContentType].singleton) throw new UserError("Te vsebine ni mogoče izbrisati.");
    const by = await referencedBy(tx, p.id);
    if (by.length) throw new UserError(`Na to se sklicuje: ${by.join(", ")}.`);
  },
  async apply(p, { actor, track }) {
    if (!actor.isOwner) throw new ForbiddenError();
    await track.delete("content", p.id);
    return null;
  },
  tags: TAGS,
});

// ── content.reorder ─────────────────────────────────────────────────────────
type ReorderPayload = { type: ContentType; ids: string[] };

export const reorderAction = defineAction<ReorderPayload>({
  name: "content.reorder",
  area: (p) => areaOfType(p.type),
  schema: reorderSchema as never,
  approvable: true,
  label: (p) => `Nov vrstni red: ${TYPES[p.type].plural}`,
  async check(p, tx) {
    if (!TYPES[p.type].orderable) throw new UserError("Te vsebine ni mogoče razvrščati.");
    if (new Set(p.ids).size !== p.ids.length) throw new UserError("Neveljavni podatki.");
    const rows = await tx.select({ id: c.id }).from(c).where(eq(c.type, p.type));
    const have = new Set(rows.map((r) => r.id));
    if (!p.ids.every((id) => have.has(id))) throw new UserError("Seznam se je medtem spremenil. Osvežite stran.");
  },
  async apply(p, { track, tx }) {
    const withOrder = hasOrderField(p.type);
    for (const [i, id] of p.ids.entries()) {
      const sort = i + 1;
      const row = await loadRow(tx, id);
      if (!row) continue;
      const orderOk = !withOrder || row.data.order === sort;
      if (row.sort === sort && orderOk) continue;
      await track.update("content", id, { sort, ...(withOrder ? { data: { ...row.data, order: sort } } : {}) });
    }
    return null;
  },
  tags: TAGS,
});

// ── content.publish ─────────────────────────────────────────────────────────
export const publishAction = defineAction<{ id: string; published: boolean }>({
  name: "content.publish",
  area: (p, tx) => areaOfId(tx, p.id),
  schema: publishSchema,
  approvable: true,
  label: async (p, tx) => {
    const row = await loadRow(tx, p.id);
    const title = row && row.type in TYPES ? titleFor(row.type as ContentType, row.data) : p.id;
    return `${p.published ? "Objavljeno" : "Skrito s strani"}: ${title}`;
  },
  async check(p, tx) {
    const row = await loadRow(tx, p.id);
    if (!row) throw new UserError(GONE);
    if (!p.published && row.type in TYPES && TYPES[row.type as ContentType].singleton) throw new UserError("Te vsebine ni mogoče skriti.");
  },
  async apply(p, { track }) {
    await track.update("content", p.id, { published: p.published });
    return null;
  },
  tags: TAGS,
});
