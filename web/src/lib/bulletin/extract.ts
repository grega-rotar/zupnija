/**
 * readBulletin: the background half of an upload. Reads the stored file with
 * Claude (prompt.ts) and leaves the bulletin in one of:
 *   draft       — a checked draft with flags (FR-10, FR-11)
 *   unreadable  — the model said so, or replied invalid JSON twice
 *   ai_busy     — claude-pool is full (exit 75) or failed (FR-13a)
 * Never throws: it runs after the response has been sent.
 *
 * The document's own period wins over the period the upload was meant for
 * (a week, a month, any span): an October booklet uploaded while November
 * was expected becomes October's bulletin, unless a bulletin starting on
 * that day exists already. The parish's reading hints (hints.ts) go into the
 * prompt.
 */
import "server-only";
import { readFile } from "node:fs/promises";
import { and, asc, eq, gte, lte, ne } from "drizzle-orm";
import { db, schema, type Db, type Tx } from "@/db";
import { AiBusyError } from "@/lib/ai/runClaude";
import { now } from "@/lib/clock";
import { addDays } from "@/lib/dates";
import { ensureMasses } from "@/lib/mase/ensure";
import { getReadingHints } from "./hints";
import { extractDraft, scheduleText } from "./prompt";
import { uploadKind, uploadPath } from "./storage";
import { sundayOf, type ChurchInfo, type PeriodMass } from "./types";

/** The period's scheduled Masses (generated first) with their church slugs. */
export async function periodMasses(dbx: Db | Tx, start: string, end: string): Promise<(PeriodMass & { id: number })[]> {
  await ensureMasses(dbx, start, end);
  const m = schema.masses, c = schema.churches;
  const rows = await dbx
    .select({ id: m.id, date: m.date, time: m.time, churchSlug: c.slug })
    .from(m)
    .innerJoin(c, eq(c.id, m.churchId))
    .where(and(gte(m.date, start), lte(m.date, end), eq(m.status, "scheduled")))
    .orderBy(asc(m.date), asc(m.time));
  return rows.map((r) => ({ ...r, time: r.time.slice(0, 5) }));
}

/** @deprecated weekly name: the Masses of the week starting on Sunday `weekStart`. */
export const weekMasses = (dbx: Db | Tx, weekStart: string) => periodMasses(dbx, weekStart, addDays(weekStart, 6));

export async function listChurches(dbx: Db | Tx = db): Promise<ChurchInfo[]> {
  return dbx.select({ slug: schema.churches.slug, name: schema.churches.name }).from(schema.churches).orderBy(asc(schema.churches.position));
}

/** The regular schedule as one line for the prompt (from the current week's Masses). */
async function scheduleLine(dbx: Db | Tx, at: string, churches: ChurchInfo[]): Promise<string> {
  const start = sundayOf(at);
  return scheduleText(await periodMasses(dbx, start, addDays(start, 6)), churches);
}

export async function readBulletin(bulletinId: number): Promise<void> {
  const b = schema.bulletins;
  const [row] = await db.select().from(b).where(eq(b.id, bulletinId));
  if (!row || row.status !== "reading" || !row.uploadId) return;
  const uploadId = row.uploadId;
  // Only the run for the current upload may write its result (a re-upload replaces it).
  const finish = (values: Partial<typeof b.$inferInsert>) =>
    db
      .update(b)
      .set({ ...values, updatedAt: now() })
      .where(and(eq(b.id, bulletinId), eq(b.uploadId, uploadId), eq(b.status, "reading")));

  try {
    const [upload] = await db.select().from(schema.uploads).where(eq(schema.uploads.id, uploadId));
    const kind = upload && uploadKind(upload.filename, upload.mime);
    if (!upload || !kind) return void (await finish({ status: "unreadable", draft: null, error: "missing_upload" }));
    const bytes = new Uint8Array(await readFile(uploadPath(upload)));
    const churches = await listChurches();
    const [schedule, hints] = await Promise.all([scheduleLine(db, row.periodStart, churches), getReadingHints()]);

    const out = await extractDraft({
      bytes,
      kind,
      period: { start: row.periodStart, end: row.periodEnd },
      massesFor: (start, end) => periodMasses(db, start, end),
      churches,
      schedule,
      hints,
    });
    if (out.status !== "draft") return void (await finish({ status: "unreadable", draft: null, error: out.reason }));

    const p = out.draft.period;
    if (p.start !== row.periodStart) {
      // The document is for another period: move the bulletin there if that period is free.
      const [taken] = await db.select({ id: b.id, title: b.title }).from(b).where(and(eq(b.periodStart, p.start), ne(b.id, bulletinId)));
      if (taken) return void (await finish({ status: "unreadable", draft: null, error: `other_period:${p.title}` }));
    }
    await finish({ status: "draft", draft: out.draft, error: null, periodStart: p.start, periodEnd: p.end, title: p.title, issue: p.issue ?? null });
  } catch (e) {
    const busy = e instanceof AiBusyError;
    if (!busy) console.error("[bulletin] reading failed", e);
    await finish({ status: "ai_busy", draft: null, error: busy ? "ai_busy" : String((e as Error)?.message ?? e).slice(0, 500) }).catch(() => {});
  }
}
