/**
 * Reads for the website-content screens (Spletna stran): the list, one
 * document, and the choices for reference fields. Writes go through
 * ./actions.ts (the engine's content.* actions).
 */
import "server-only";
import { eq, inArray } from "drizzle-orm";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { db, schema } from "@/db";
import { requirePageArea } from "@/lib/admin/next";
import type { Actor } from "@/lib/admin/sections";
import { requireActor } from "@/lib/admin/session";
import { isContentType, TYPES, titleOf, type ContentType, type Doc, type Field, type TypeDef } from "@/lib/content/fields";

const c = schema.content;

export type ListRow = { id: string; title: string; subtitle: string; published: boolean; updatedAt: string; path: string | null };
export type RefOption = { id: string; type: string; title: string; subtitle: string };

/** The type from the URL, and the actor when they may edit it (else Domov). */
export async function requireType(param: string): Promise<{ def: TypeDef; actor: Actor }> {
  if (!isContentType(param)) notFound();
  const def = TYPES[param];
  if (def.area === "owner") {
    const actor = await requireActor();
    if (!actor.isOwner) redirect("/");
    return { def, actor };
  }
  return { def, actor: await requirePageArea(def.area) };
}

const sortValue = (d: Doc, field: string) => {
  const v = d[field];
  return typeof v === "string" ? v : typeof v === "number" ? String(v).padStart(12, "0") : "";
};

/** Every document of a type, in the order the list shows it. */
export async function listDocs(def: TypeDef): Promise<ListRow[]> {
  const rows = await db.select().from(c).where(eq(c.type, def.type));
  const docs = rows.map((r) => ({ r, d: r.data as Doc }));
  if (def.orderable) docs.sort((a, b) => a.r.sort - b.r.sort || titleOf(def, a.d).localeCompare(titleOf(def, b.d), "sl"));
  else if (def.orderBy) {
    const { field, desc } = def.orderBy;
    docs.sort((a, b) => sortValue(a.d, field).localeCompare(sortValue(b.d, field), "sl") * (desc ? -1 : 1));
  }
  return docs.map(({ r, d }) => ({
    id: r.id,
    title: titleOf(def, d),
    subtitle: def.subtitle?.(d) ?? "",
    published: r.published,
    updatedAt: r.updatedAt.toISOString(),
    path: def.publicPath?.(d) ?? null,
  }));
}

export async function getDoc(def: TypeDef, id: string) {
  const [row] = await db.select().from(c).where(eq(c.id, id));
  if (!row || row.type !== def.type) return null;
  return { id: row.id, data: row.data as Doc, published: row.published };
}

/** Every content type a reference field in this form can point to. */
function refTargets(fields: Field[], out = new Set<ContentType>()): Set<ContentType> {
  for (const f of fields) {
    if (f.kind === "reference") f.to.forEach((t) => isContentType(t) && out.add(t));
    if (f.kind === "object") refTargets(f.fields, out);
    if (f.kind === "array") f.of.forEach((o) => refTargets(o.fields, out));
  }
  return out;
}

/** The documents a reference field may choose from, by type (drafts included, marked by the picker). */
export async function refOptions(def: TypeDef): Promise<RefOption[]> {
  const types = [...refTargets(def.fields)];
  if (!types.length) return [];
  const rows = await db.select({ id: c.id, type: c.type, data: c.data }).from(c).where(inArray(c.type, types));
  return rows
    .map((r) => {
      const t = TYPES[r.type as ContentType];
      const d = r.data as Doc;
      return { id: r.id, type: r.type, title: titleOf(t, d), subtitle: t.subtitle?.(d) ?? t.label };
    })
    .sort((a, b) => a.title.localeCompare(b.title, "sl"));
}

/** The public site's origin for "Odpri na strani": NEXT_PUBLIC_SITE_URL, else this host without "admin.". */
export async function siteOrigin(): Promise<string> {
  const env = process.env.NEXT_PUBLIC_SITE_URL;
  if (env) return env.replace(/\/+$/, "");
  const h = await headers();
  const host = (h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000").replace(/^admin\./, "");
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}
