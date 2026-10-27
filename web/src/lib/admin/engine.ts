/**
 * The change engine: every write in the editor goes through `perform`.
 *
 *   perform(actor, "intention.add", payload)
 *     → permission check (section)  → ForbiddenError
 *     → zod validation              → UserError (first issue's message)
 *     → helper needing approval     → change_requests row, status "pending"
 *     → otherwise                   → apply in a transaction + one history row
 *
 * Approving a change request runs the same `apply` (FR-5). Actions write only
 * through the Tracker, so every applied change can be undone generically from
 * its recorded before/after rows (FR-6).
 *
 * Feature code registers actions with `defineAction` in its own module
 * (e.g. src/lib/masses/actions.ts) and imports that module from
 * src/lib/admin/registry.ts so the registry is complete everywhere.
 */
import { and, desc, eq, getTableColumns, isNull, type InferSelectModel } from "drizzle-orm";
import type { PgTable } from "drizzle-orm/pg-core";
import type { z } from "zod";
import { db as defaultDb, schema, type Db, type Tx } from "@/db";
import { now } from "@/lib/clock";
import { ForbiddenError, UserError } from "./errors";
import { can, needsApproval, type Actor, type Area, type Section } from "./sections";

// ── Tracked tables ──────────────────────────────────────────────────────────
/** Tables actions may write. All have a single `id` primary key. */
export const TRACKED = {
  masses: schema.masses,
  intentions: schema.intentions,
  events: schema.events,
  catechesis_groups: schema.catechesisGroups,
  catechesis_cancellations: schema.catechesisCancellations,
  bulletins: schema.bulletins,
  bulletin_notices: schema.bulletinNotices,
  user: schema.user,
} as const;
export type TrackedName = keyof typeof TRACKED | "user_sections";
type Row = Record<string, unknown>;

/** One row before and after an applied change. null = did not exist. */
export type RowChange = { table: TrackedName; id: string | number; before: Row | null; after: Row | null };

const json = (r: unknown) => (r == null ? null : (JSON.parse(JSON.stringify(r)) as Row));

/** Turn JSON-stored values back into what drizzle expects (Dates for timestamps). */
function revive(table: PgTable, row: Row): Row {
  const cols = getTableColumns(table) as Record<string, { columnType: string }>;
  const out: Row = {};
  for (const [k, v] of Object.entries(row)) {
    out[k] = v != null && cols[k]?.columnType === "PgTimestamp" ? new Date(v as string) : v;
  }
  return out;
}

/**
 * Writes for actions. Each call performs the write and records it.
 * Use `tx` directly only for reads.
 */
export class Tracker {
  readonly changes: RowChange[] = [];
  constructor(readonly tx: Tx) {}

  async insert<N extends keyof typeof TRACKED>(name: N, values: Row): Promise<InferSelectModel<(typeof TRACKED)[N]>> {
    const t = TRACKED[name] as unknown as PgTable & { id: never };
    const [row] = (await this.tx.insert(t).values(values as never).returning()) as Row[];
    this.changes.push({ table: name, id: row.id as number, before: null, after: json(row) });
    return row as never;
  }

  async update<N extends keyof typeof TRACKED>(name: N, id: number | string, patch: Row): Promise<InferSelectModel<(typeof TRACKED)[N]>> {
    const t = TRACKED[name] as unknown as PgTable & { id: never };
    const idCol = (t as unknown as Record<string, never>).id;
    const [before] = (await this.tx.select().from(t).where(eq(idCol, id as never))) as Row[];
    if (!before) throw new UserError("Ta vnos ne obstaja več.");
    const values = "updatedAt" in getTableColumns(t) ? { ...patch, updatedAt: now() } : patch;
    const [row] = (await this.tx.update(t).set(values as never).where(eq(idCol, id as never)).returning()) as Row[];
    this.changes.push({ table: name, id, before: json(before), after: json(row) });
    return row as never;
  }

  async delete<N extends keyof typeof TRACKED>(name: N, id: number | string): Promise<void> {
    const t = TRACKED[name] as unknown as PgTable;
    const idCol = (t as unknown as Record<string, never>).id;
    const [before] = (await this.tx.delete(t).where(eq(idCol, id as never)).returning()) as Row[];
    if (before) this.changes.push({ table: name, id, before: json(before), after: null });
  }

  /** Replace a user's sections (composite-key table, recorded as one change). */
  async setSections(userId: string, sections: Section[]): Promise<void> {
    const us = schema.userSections;
    const before = (await this.tx.select().from(us).where(eq(us.userId, userId))).map((r) => r.section).sort();
    await this.tx.delete(us).where(eq(us.userId, userId));
    if (sections.length) await this.tx.insert(us).values(sections.map((section) => ({ userId, section })));
    this.changes.push({ table: "user_sections", id: userId, before: { sections: before }, after: { sections: [...sections].sort() } });
  }
}

// ── Actions ─────────────────────────────────────────────────────────────────
/** `requestedBy` is the helper whose change request is being approved (else the actor). */
export type ActionCtx = { actor: Actor; track: Tracker; tx: Tx; requestedBy: string };

export type ActionDef<P> = {
  name: string;
  area: Area;
  schema: z.ZodType<P>;
  /** false = cannot be queued for approval (e.g. owner-only, or undo-like). */
  approvable: boolean;
  /** History / approval-list label, e.g. "Nov namen † Jože Novak". */
  label: (p: P, tx: Tx) => Promise<string> | string;
  /** Throw UserError when the change no longer makes sense (checked again on approve). */
  check?: (p: P, tx: Tx) => Promise<void>;
  apply: (p: P, ctx: ActionCtx) => Promise<unknown>;
  /** Cache tags the public site uses; revalidated after commit. */
  tags: string[];
};

const registry = new Map<string, ActionDef<unknown>>();

export function defineAction<P>(def: ActionDef<P>): ActionDef<P> {
  registry.set(def.name, def as ActionDef<unknown>);
  return def;
}

export function getAction(name: string): ActionDef<unknown> {
  const def = registry.get(name);
  if (!def) throw new Error(`Unknown action ${name}`);
  return def;
}

export function listActions(): string[] {
  return [...registry.keys()].sort();
}

// ── Revalidation hook (Next's revalidateTag in the app, a spy in tests) ─────
let revalidate: (tag: string) => void = () => {};
export function setRevalidator(fn: (tag: string) => void): void {
  revalidate = fn;
}

// ── perform / approve / reject / undo ───────────────────────────────────────
export type PerformResult =
  | { status: "applied"; historyId: number; result: unknown }
  | { status: "pending"; changeRequestId: number };

function parse<P>(def: ActionDef<P>, payload: unknown): P {
  const r = def.schema.safeParse(payload);
  if (!r.success) throw new UserError(r.error.issues[0]?.message ?? "Neveljavni podatki.");
  return r.data;
}

async function applyNow<P>(dbx: Db, actor: Actor, def: ActionDef<P>, p: P, labelPrefix = "", note?: string, requestedBy = actor.id) {
  const out = await dbx.transaction(async (tx) => {
    await def.check?.(p, tx);
    const track = new Tracker(tx);
    const result = await def.apply(p, { actor, track, tx, requestedBy });
    const label = labelPrefix + (await def.label(p, tx));
    const [h] = await tx
      .insert(schema.history)
      .values({ userId: actor.id, section: def.area, action: def.name, label, note, changes: track.changes, createdAt: now() })
      .returning({ id: schema.history.id });
    return { historyId: h.id, result };
  });
  def.tags.forEach((t) => revalidate(t));
  return out;
}

export async function perform(actor: Actor, name: string, payload: unknown, dbx: Db = defaultDb): Promise<PerformResult> {
  const def = getAction(name);
  if (!can(actor, def.area)) throw new ForbiddenError();
  const p = parse(def, payload);
  if (def.approvable && needsApproval(actor)) {
    await def.check?.(p, dbx as unknown as Tx);
    const label = await def.label(p, dbx as unknown as Tx);
    const [cr] = await dbx
      .insert(schema.changeRequests)
      .values({ section: def.area as Section, action: name, payload: p as object, label, createdBy: actor.id, createdAt: now() })
      .returning({ id: schema.changeRequests.id });
    revalidate("approvals");
    return { status: "pending", changeRequestId: cr.id };
  }
  const { historyId, result } = await applyNow(dbx, actor, def, p);
  return { status: "applied", historyId, result };
}

async function pendingRequest(dbx: Db, id: number) {
  const [cr] = await dbx.select().from(schema.changeRequests).where(eq(schema.changeRequests.id, id));
  if (!cr || cr.status !== "pending") throw new UserError("Ta sprememba je že obravnavana.");
  return cr;
}

/** Owner applies a helper's change with the same action code (FR-5). */
export async function approve(owner: Actor, id: number, dbx: Db = defaultDb): Promise<{ historyId: number }> {
  if (!owner.isOwner) throw new ForbiddenError();
  const cr = await pendingRequest(dbx, id);
  const def = getAction(cr.action);
  const p = parse(def, cr.payload);
  const { historyId } = await applyNow(dbx, owner, def, p, "Potrjeno: ", `predlog: ${cr.createdBy}`, cr.createdBy);
  await dbx
    .update(schema.changeRequests)
    .set({ status: "approved", decidedBy: owner.id, decidedAt: now() })
    .where(eq(schema.changeRequests.id, id));
  revalidate("approvals");
  return { historyId };
}

export async function reject(owner: Actor, id: number, dbx: Db = defaultDb): Promise<void> {
  if (!owner.isOwner) throw new ForbiddenError();
  await pendingRequest(dbx, id);
  await dbx
    .update(schema.changeRequests)
    .set({ status: "rejected", decidedBy: owner.id, decidedAt: now() })
    .where(eq(schema.changeRequests.id, id));
  revalidate("approvals");
}

export async function listPending(dbx: Db = defaultDb, createdBy?: string) {
  const cr = schema.changeRequests;
  return dbx
    .select()
    .from(cr)
    .where(createdBy ? and(eq(cr.status, "pending"), eq(cr.createdBy, createdBy)) : eq(cr.status, "pending"))
    .orderBy(cr.createdAt);
}

const STALE = "Tega ni več mogoče razveljaviti, ker je bilo medtem spremenjeno.";
/** JSON with sorted keys: select() and returning() order columns differently. */
const stable = (r: Row | null) => (r == null ? "null" : JSON.stringify(Object.keys(r).sort().map((k) => [k, r[k]])));

async function currentRow(tx: Tx, c: RowChange): Promise<Row | null> {
  if (c.table === "user_sections") {
    const rows = await tx.select().from(schema.userSections).where(eq(schema.userSections.userId, String(c.id)));
    return { sections: rows.map((r) => r.section).sort() };
  }
  const t = TRACKED[c.table] as unknown as PgTable;
  const idCol = (t as unknown as Record<string, never>).id;
  const [row] = (await tx.select().from(t).where(eq(idCol, c.id as never))) as Row[];
  return json(row ?? null);
}

/** Undo one applied change: the author (or the owner) while nothing touched it since. */
export async function undo(actor: Actor, historyId: number, dbx: Db = defaultDb): Promise<{ historyId: number }> {
  const out = await dbx.transaction(async (tx) => {
    const [h] = await tx.select().from(schema.history).where(eq(schema.history.id, historyId));
    if (!h || h.undoneAt) throw new UserError("Te spremembe ni več mogoče razveljaviti.");
    if (h.userId !== actor.id && !actor.isOwner) throw new ForbiddenError();
    const changes = h.changes as RowChange[];
    for (const c of changes) {
      if (stable(await currentRow(tx, c)) !== stable(c.after)) throw new UserError(STALE);
    }
    const inverse: RowChange[] = [];
    for (const c of [...changes].reverse()) {
      if (c.table === "user_sections") {
        const us = schema.userSections;
        const userId = String(c.id), secs = ((c.before?.sections as Section[]) ?? []);
        await tx.delete(us).where(eq(us.userId, userId));
        if (secs.length) await tx.insert(us).values(secs.map((section) => ({ userId, section })));
      } else {
        const t = TRACKED[c.table] as unknown as PgTable;
        const idCol = (t as unknown as Record<string, never>).id;
        if (c.after && !c.before) await tx.delete(t).where(eq(idCol, c.id as never));
        else if (c.before && !c.after) await tx.insert(t).values(revive(t, c.before) as never);
        else if (c.before) await tx.update(t).set(revive(t, c.before) as never).where(eq(idCol, c.id as never));
      }
      inverse.push({ table: c.table, id: c.id, before: c.after, after: c.before });
    }
    await tx.update(schema.history).set({ undoneAt: now() }).where(eq(schema.history.id, historyId));
    const [nh] = await tx
      .insert(schema.history)
      .values({ userId: actor.id, section: h.section, action: "undo", label: `Razveljavljeno: ${h.label}`, changes: inverse, undoneAt: now(), createdAt: now() })
      .returning({ id: schema.history.id });
    return { historyId: nh.id, action: h.action };
  });
  const def = registry.get(out.action);
  def?.tags.forEach((t) => revalidate(t));
  return { historyId: out.historyId };
}

/** The newest not-yet-undone change by this actor (for the toast's "Razveljavi"). */
export async function lastUndoable(actor: Actor, dbx: Db = defaultDb) {
  const h = schema.history;
  const [row] = await dbx
    .select()
    .from(h)
    .where(and(eq(h.userId, actor.id), isNull(h.undoneAt)))
    .orderBy(desc(h.id))
    .limit(1);
  return row ?? null;
}
