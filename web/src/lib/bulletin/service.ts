/**
 * Server-side bulletin functions the oznanila screens call through their
 * server actions (which call requireSection("oznanila") first).
 *
 *   startBulletin   upload → bulletin "reading" → readBulletin after the response
 *   startManual     "Vpiši ročno": an empty draft without AI
 *   getBulletin / getBulletinByPeriod / listBulletins / nextMissingPeriod
 *   saveDraftForLater / discardDraft
 *   publishBulletin perform("bulletin.publish"); a helper's → status "pending"
 *
 * A bulletin covers a period: today a calendar month, before that weeks, and
 * any other span works. The upload target defaults to the missing period
 * (types.ts missingPeriod: the next day no published or pending bulletin
 * covers starts it); the document's own period wins once it is read.
 */
import "server-only";
import { and, desc, eq, sql } from "drizzle-orm";
import { after } from "next/server";
import { db, schema } from "@/db";
import { perform, type PerformResult } from "@/lib/admin/engine";
import { ForbiddenError, UserError } from "@/lib/admin/errors";
import { can, type Actor } from "@/lib/admin/sections";
import { now, today } from "@/lib/clock";
import { ALREADY_PUBLISHED, type PublishPayload } from "./actions";
import { readBulletin } from "./extract";
import { saveUpload, type UploadInput } from "./storage";
import {
  allIntentions,
  emptyDraft,
  flagCount,
  missingPeriod,
  monthPeriod,
  periodTitle,
  readableDraftSchema,
  type BulletinStatus,
  type MissingPeriod,
  type ReadableDraft,
} from "./types";
import "./actions";

export const AI_BUSY_MESSAGE = "Pomočnik je trenutno zaseden. Poskusite čez nekaj minut ali vpišite ročno.";
const PENDING = "Ta oznanila čakajo na potrditev župnika.";

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
  periodStart: string;
  periodEnd: string;
  title: string;
  status: BulletinStatus | "missing";
  /** Intentions in the draft. */
  itemCount: number;
  flagCount: number;
  noticeCount: number;
  eventCount: number;
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
  return { ...b, upload: upload ?? null, notices, readableDraft, flagCount: readableDraft ? flagCount(readableDraft) : 0 };
}

export async function getBulletinByPeriod(periodStart: string): Promise<BulletinView | null> {
  const [b] = await db.select({ id: schema.bulletins.id }).from(schema.bulletins).where(eq(schema.bulletins.periodStart, periodStart));
  return b ? getBulletin(b.id) : null;
}

/** The period to upload next (and whether it is due), from all bulletins. */
export async function nextMissingPeriod(): Promise<MissingPeriod> {
  const rows = await db.select({ id: schema.bulletins.id, status: schema.bulletins.status, periodStart: schema.bulletins.periodStart, periodEnd: schema.bulletins.periodEnd }).from(schema.bulletins);
  return missingPeriod(today(), await Promise.all(rows.map(settlePending)));
}
/** @deprecated same as nextMissingPeriod. */
export const nextMissingMonth = nextMissingPeriod;

/** Newest period first; the missing period (missingPeriod) appears as "missing" while it has no row. */
export async function listBulletins(): Promise<BulletinListEntry[]> {
  const rows = await Promise.all((await db.select().from(schema.bulletins).orderBy(desc(schema.bulletins.periodStart))).map(settlePending));
  const notices = await db.select({ bulletinId: schema.bulletinNotices.bulletinId }).from(schema.bulletinNotices);
  const events = await db.select({ b: schema.events.sourceBulletinId }).from(schema.events);
  const out: BulletinListEntry[] = rows.map((b) => {
    const d = asReadable(b.draft);
    const published = b.status === "published";
    return {
      id: b.id,
      periodStart: b.periodStart,
      periodEnd: b.periodEnd,
      title: b.title,
      status: b.status,
      itemCount: d ? allIntentions(d).length : 0,
      flagCount: d && !published ? flagCount(d) : 0,
      noticeCount: published ? notices.filter((n) => n.bulletinId === b.id).length : (d?.notices.length ?? 0),
      eventCount: published ? events.filter((e) => e.b === b.id).length : (d?.events.filter((e) => e.include).length ?? 0),
      publishedAt: b.publishedAt,
      publishedBy: b.publishedBy,
      updatedAt: b.updatedAt,
    };
  });
  const next = missingPeriod(today(), rows);
  if (!rows.some((b) => b.periodStart === next.start)) {
    out.push({ id: null, periodStart: next.start, periodEnd: next.end, title: next.title, status: "missing", itemCount: 0, flagCount: 0, noticeCount: 0, eventCount: 0, publishedAt: null, publishedBy: null, updatedAt: null });
    out.sort((a, b) => b.periodStart.localeCompare(a.periodStart));
  }
  return out;
}

// ── Writes ──────────────────────────────────────────────────────────────────
export type PeriodInput = { periodStart?: string; periodEnd?: string };
const ISO = /^\d{4}-\d{2}-\d{2}$/;

/**
 * The period an upload is meant for: `periodStart`…`periodEnd` when given
 * (end defaults to the end of start's month), else the missing period.
 */
async function targetPeriod(p: PeriodInput): Promise<{ start: string; end: string; title: string }> {
  if (p.periodStart == null) {
    const m = await nextMissingPeriod();
    return { start: m.start, end: m.end, title: m.title };
  }
  const start = p.periodStart, end = p.periodEnd ?? monthPeriod(start).end;
  if (!ISO.test(start) || !ISO.test(end) || Number.isNaN(Date.parse(start)) || end < start) throw new UserError("Izberite obdobje.");
  return { start, end, title: periodTitle(start, end) };
}

async function preparePeriod(input: PeriodInput, actor: Actor) {
  if (!can(actor, "oznanila")) throw new ForbiddenError();
  const period = await targetPeriod(input);
  const [found] = await db.select().from(schema.bulletins).where(eq(schema.bulletins.periodStart, period.start));
  const existing = found ? await settlePending(found) : null;
  if (existing?.status === "published") throw new UserError(ALREADY_PUBLISHED);
  if (existing?.status === "pending") throw new UserError(PENDING);
  return { period, existing: existing ?? null };
}

async function upsertBulletin(existing: Bulletin | null, period: { start: string; end: string; title: string }, values: Partial<typeof schema.bulletins.$inferInsert>) {
  const b = schema.bulletins;
  const set = { uploadId: null, draft: null, error: null, periodEnd: period.end, title: period.title, issue: null, ...values, updatedAt: now() };
  if (existing) {
    await db.update(b).set(set).where(eq(b.id, existing.id));
    return existing.id;
  }
  const [row] = await db
    .insert(b)
    .values({ periodStart: period.start, status: "reading", ...set, createdAt: now() })
    .onConflictDoNothing()
    .returning({ id: b.id });
  if (!row) throw new UserError("Ta oznanila se že nalagajo. Osvežite stran.");
  return row.id;
}

/**
 * Store the upload and start reading it after the response. Replaces an
 * unpublished bulletin starting on the same day; never a published or
 * pending one. The period defaults to the missing period.
 */
export async function startBulletin(input: PeriodInput & { file: UploadInput }, actor: Actor): Promise<{ bulletinId: number }> {
  const { period, existing } = await preparePeriod(input, actor);
  const upload = await saveUpload(input.file, actor);
  const bulletinId = await upsertBulletin(existing, period, { status: "reading", uploadId: upload.id });
  schedule(() => readBulletin(bulletinId));
  return { bulletinId };
}

/** "Vpiši ročno": an empty draft for the period, filled in by hand. */
export async function startManualBulletin(input: PeriodInput, actor: Actor): Promise<{ bulletinId: number }> {
  const { period, existing } = await preparePeriod(input, actor);
  const draft = emptyDraft(period);
  return { bulletinId: await upsertBulletin(existing, period, { status: "draft", uploadId: existing?.uploadId ?? null, draft }) };
}

async function editable(id: number) {
  const [row] = await db.select().from(schema.bulletins).where(eq(schema.bulletins.id, id));
  if (!row) throw new UserError("Teh oznanil ni več.");
  const b = await settlePending(row);
  if (b.status === "published") throw new UserError(ALREADY_PUBLISHED);
  if (b.status === "pending") throw new UserError(PENDING);
  return b;
}

/**
 * "Shrani za pozneje", and before publishing: keep the (edited) draft —
 * notices, event include toggles, added or removed intentions, article,
 * prayer intention. The period's dates stay the bulletin's; its title and
 * issue may be edited. Status stays "draft".
 */
export async function saveDraftForLater(id: number, draft?: ReadableDraft): Promise<void> {
  const b = await editable(id);
  if (b.status !== "draft") throw new UserError("Ta oznanila nimajo osnutka za objavo.");
  const values: Partial<typeof schema.bulletins.$inferInsert> = { updatedAt: now() };
  if (draft) {
    const r = readableDraftSchema.safeParse({ ...draft, period: { ...draft.period, start: b.periodStart, end: b.periodEnd } });
    if (!r.success) throw new UserError("Osnutek ni veljaven.");
    const ids = allIntentions(r.data).map((i) => i.id).concat(r.data.events.map((e) => e.id));
    if (new Set(ids).size !== ids.length) throw new UserError("Osnutek ni veljaven.");
    values.draft = r.data;
    values.title = r.data.period.title;
    values.issue = r.data.period.issue ?? null;
  }
  await db.update(schema.bulletins).set(values).where(eq(schema.bulletins.id, id));
}

/** "Zavrzi": remove the unpublished bulletin; its period shows as missing again. */
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
