/**
 * Server-side bulletin functions the oznanila screens call through their
 * server actions (which call requireSection("oznanila") first).
 *
 *   startBulletin   upload → bulletin "reading" → readBulletin after the response
 *   startManual     "Vpiši ročno": an empty draft without AI
 *   getBulletin / listBulletins
 *   saveDraftForLater / discardDraft
 *   publishBulletin perform("bulletin.publish"); a helper's → status "pending"
 */
import "server-only";
import { and, desc, eq, sql } from "drizzle-orm";
import { after } from "next/server";
import { db, schema } from "@/db";
import { perform, type PerformResult } from "@/lib/admin/engine";
import { ForbiddenError, UserError } from "@/lib/admin/errors";
import { can, type Actor } from "@/lib/admin/sections";
import { now, today, weekStart as weekStartOf } from "@/lib/clock";
import { addDays } from "@/lib/dates";
import { ALREADY_PUBLISHED, type PublishPayload } from "./actions";
import { readBulletin } from "./extract";
import { saveUpload, type UploadInput } from "./storage";
import { flaggedItems, readableDraftSchema, type BulletinStatus, type ReadableDraft } from "./types";
import "./actions";

export const AI_BUSY_MESSAGE = "Pomočnik je trenutno zaseden. Poskusite čez nekaj minut ali vpišite ročno.";
const PENDING = "Oznanila za ta teden čakajo na potrditev župnika.";

// ── Background work: Next's after() in the app; tests replace it ───────────
type Task = () => Promise<void>;
let schedule: (task: Task) => void = (task) => {
  try {
    after(task);
  } catch {
    // Outside a request (scripts): just run it.
    void task().catch((e) => console.error("[bulletin] background task failed", e));
  }
};
/** Tests: run background work your way (e.g. collect the promises); null restores after(). */
export function setBulletinScheduler(fn: ((task: Task) => void) | null): void {
  schedule = fn ?? ((task) => after(task));
}

/**
 * A "pending" bulletin whose change request was rejected goes back to "draft"
 * (the engine's reject doesn't know about bulletins).
 */
async function settlePending<B extends { id: number; status: BulletinStatus }>(b: B): Promise<B> {
  if (b.status !== "pending") return b;
  const cr = schema.changeRequests;
  const [open] = await db
    .select({ id: cr.id })
    .from(cr)
    .where(and(eq(cr.status, "pending"), eq(cr.action, "bulletin.publish"), sql`(${cr.payload}->>'bulletinId')::int = ${b.id}`))
    .limit(1);
  if (open) return b;
  await db.update(schema.bulletins).set({ status: "draft", updatedAt: now() }).where(and(eq(schema.bulletins.id, b.id), eq(schema.bulletins.status, "pending")));
  return { ...b, status: "draft" };
}

// ── Reads ───────────────────────────────────────────────────────────────────
export type Bulletin = typeof schema.bulletins.$inferSelect;
export type BulletinView = Bulletin & {
  upload: { id: number; filename: string; mime: string; size: number } | null;
  notices: { id: number; position: number; text: string }[];
  /** The draft when it is readable (status draft/pending). */
  readableDraft: ReadableDraft | null;
  flagCount: number;
};
export type BulletinListEntry = {
  id: number | null;
  weekStart: string;
  status: BulletinStatus | "missing";
  itemCount: number;
  flagCount: number;
  noticeCount: number;
  publishedAt: Date | null;
  publishedBy: string | null;
  updatedAt: Date | null;
};

const asReadable = (d: unknown) => {
  const r = readableDraftSchema.safeParse(d);
  return r.success ? r.data : null;
};

export async function getBulletin(id: number): Promise<BulletinView | null> {
  const [row] = await db.select().from(schema.bulletins).where(eq(schema.bulletins.id, id));
  if (!row) return null;
  const b = await settlePending(row);
  const [upload] = b.uploadId
    ? await db
        .select({ id: schema.uploads.id, filename: schema.uploads.filename, mime: schema.uploads.mime, size: schema.uploads.size })
        .from(schema.uploads)
        .where(eq(schema.uploads.id, b.uploadId))
    : [];
  const notices = await db
    .select({ id: schema.bulletinNotices.id, position: schema.bulletinNotices.position, text: schema.bulletinNotices.text })
    .from(schema.bulletinNotices)
    .where(eq(schema.bulletinNotices.bulletinId, id))
    .orderBy(schema.bulletinNotices.position);
  const readableDraft = asReadable(b.draft);
  return { ...b, upload: upload ?? null, notices, readableDraft, flagCount: readableDraft ? flaggedItems(readableDraft).length : 0 };
}

export async function getBulletinByWeek(weekStart: string): Promise<BulletinView | null> {
  const [b] = await db.select({ id: schema.bulletins.id }).from(schema.bulletins).where(eq(schema.bulletins.weekStart, weekStart));
  return b ? getBulletin(b.id) : null;
}

/** Newest week first; next week (the Sunday after today) appears as "missing" while it has no row. */
export async function listBulletins(): Promise<BulletinListEntry[]> {
  const rows = await Promise.all((await db.select().from(schema.bulletins).orderBy(desc(schema.bulletins.weekStart))).map(settlePending));
  const notices = await db.select({ bulletinId: schema.bulletinNotices.bulletinId }).from(schema.bulletinNotices);
  const out: BulletinListEntry[] = rows.map((b) => {
    const d = asReadable(b.draft);
    return {
      id: b.id,
      weekStart: b.weekStart,
      status: b.status,
      itemCount: d?.items.length ?? 0,
      flagCount: d ? flaggedItems(d).length : 0,
      noticeCount: b.status === "published" ? notices.filter((n) => n.bulletinId === b.id).length : (d?.notices.length ?? 0),
      publishedAt: b.publishedAt,
      publishedBy: b.publishedBy,
      updatedAt: b.updatedAt,
    };
  });
  const next = nextWeekStart();
  if (!rows.some((b) => b.weekStart === next)) {
    out.push({ id: null, weekStart: next, status: "missing", itemCount: 0, flagCount: 0, noticeCount: 0, publishedAt: null, publishedBy: null, updatedAt: null });
    out.sort((a, b) => b.weekStart.localeCompare(a.weekStart));
  }
  return out;
}

/** The Sunday after today ("2026-10-27" → "2026-11-01"); weeks run Sunday–Saturday. */
export const nextWeekStart = () => addDays(weekStartOf(today()), 7);

// ── Writes ──────────────────────────────────────────────────────────────────
function assertWeekStart(weekStart: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(weekStart) || weekStartOf(weekStart) !== weekStart) throw new UserError("Izberite teden.");
}

async function prepareWeek(weekStart: string, actor: Actor) {
  if (!can(actor, "oznanila")) throw new ForbiddenError();
  assertWeekStart(weekStart);
  const [found] = await db.select().from(schema.bulletins).where(eq(schema.bulletins.weekStart, weekStart));
  const existing = found ? await settlePending(found) : null;
  if (existing?.status === "published") throw new UserError(ALREADY_PUBLISHED);
  if (existing?.status === "pending") throw new UserError(PENDING);
  return existing ?? null;
}

async function upsertBulletin(existing: Bulletin | null, weekStart: string, values: Partial<typeof schema.bulletins.$inferInsert>) {
  const b = schema.bulletins;
  const set = { uploadId: null, draft: null, error: null, ...values, updatedAt: now() };
  if (existing) {
    await db.update(b).set(set).where(eq(b.id, existing.id));
    return existing.id;
  }
  const [row] = await db
    .insert(b)
    .values({ weekStart, status: "reading", ...set, createdAt: now() })
    .onConflictDoNothing()
    .returning({ id: b.id });
  if (!row) throw new UserError("Oznanila za ta teden se že nalagajo. Osvežite stran.");
  return row.id;
}

/**
 * Store the upload and start reading it after the response. Replaces an
 * unpublished bulletin of the same week; never a published or pending one.
 */
export async function startBulletin(input: { weekStart: string; file: UploadInput }, actor: Actor): Promise<{ bulletinId: number }> {
  const existing = await prepareWeek(input.weekStart, actor);
  const upload = await saveUpload(input.file, actor);
  const bulletinId = await upsertBulletin(existing, input.weekStart, { status: "reading", uploadId: upload.id });
  schedule(() => readBulletin(bulletinId));
  return { bulletinId };
}

/** "Vpiši ročno": an empty draft for the week, filled in by hand. */
export async function startManualBulletin(input: { weekStart: string }, actor: Actor): Promise<{ bulletinId: number }> {
  const existing = await prepareWeek(input.weekStart, actor);
  const draft: ReadableDraft = { readable: true, weekStart: input.weekStart, items: [], notices: [] };
  return { bulletinId: await upsertBulletin(existing, input.weekStart, { status: "draft", uploadId: existing?.uploadId ?? null, draft }) };
}

async function editable(id: number) {
  const [row] = await db.select().from(schema.bulletins).where(eq(schema.bulletins.id, id));
  if (!row) throw new UserError("Teh oznanil ni več.");
  const b = await settlePending(row);
  if (b.status === "published") throw new UserError(ALREADY_PUBLISHED);
  if (b.status === "pending") throw new UserError(PENDING);
  return b;
}

/** "Shrani za pozneje": keep the draft (optionally the edited one); status stays "draft". */
export async function saveDraftForLater(id: number, draft?: ReadableDraft): Promise<void> {
  const b = await editable(id);
  if (b.status !== "draft") throw new UserError("Ta oznanila nimajo osnutka za objavo.");
  const values: Partial<typeof schema.bulletins.$inferInsert> = { updatedAt: now() };
  if (draft) {
    const r = readableDraftSchema.safeParse({ ...draft, weekStart: b.weekStart });
    if (!r.success) throw new UserError("Osnutek ni veljaven.");
    values.draft = r.data;
  }
  await db.update(schema.bulletins).set(values).where(eq(schema.bulletins.id, id));
}

/** "Zavrzi": remove the unpublished bulletin; the week shows as missing again. */
export async function discardDraft(id: number): Promise<void> {
  await editable(id);
  await db.delete(schema.bulletins).where(eq(schema.bulletins.id, id));
}

/** Publish through the engine; a helper's publish waits for the owner ("pending"). */
export async function publishBulletin(actor: Actor, payload: PublishPayload): Promise<PerformResult> {
  const r = await perform(actor, "bulletin.publish", payload);
  if (r.status === "pending") {
    await db.update(schema.bulletins).set({ status: "pending", updatedAt: now() }).where(eq(schema.bulletins.id, payload.bulletinId));
  }
  return r;
}
