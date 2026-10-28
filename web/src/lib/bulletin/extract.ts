/**
 * readBulletin: the background half of an upload. Reads the stored file with
 * Claude (prompt.ts) and leaves the bulletin in one of:
 *   draft       — a checked draft with flags (FR-10, FR-11)
 *   unreadable  — the model said so, or replied invalid JSON twice
 *   ai_busy     — claude-pool is full (exit 75) or failed (FR-13a)
 * Never throws: it runs after the response has been sent.
 */
import "server-only";
import { readFile } from "node:fs/promises";
import { and, asc, eq, gte, lte } from "drizzle-orm";
import { db, schema, type Db, type Tx } from "@/db";
import { AiBusyError } from "@/lib/ai/runClaude";
import { now } from "@/lib/clock";
import { addDays } from "@/lib/dates";
import { ensureMasses } from "@/lib/mase/ensure";
import { extractDraft } from "./prompt";
import { uploadKind, uploadPath } from "./storage";
import type { ChurchInfo, WeekMass } from "./types";

/** The week's scheduled Masses (generated first) with their church slugs. */
export async function weekMasses(dbx: Db | Tx, weekStart: string): Promise<(WeekMass & { id: number })[]> {
  const end = addDays(weekStart, 6);
  await ensureMasses(dbx, weekStart, end);
  const m = schema.masses, c = schema.churches;
  const rows = await dbx
    .select({ id: m.id, date: m.date, time: m.time, churchSlug: c.slug })
    .from(m)
    .innerJoin(c, eq(c.id, m.churchId))
    .where(and(gte(m.date, weekStart), lte(m.date, end), eq(m.status, "scheduled")))
    .orderBy(asc(m.date), asc(m.time));
  return rows.map((r) => ({ ...r, time: r.time.slice(0, 5) }));
}

export async function listChurches(dbx: Db | Tx = db): Promise<ChurchInfo[]> {
  return dbx.select({ slug: schema.churches.slug, name: schema.churches.name }).from(schema.churches).orderBy(asc(schema.churches.position));
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
    const [masses, churches] = await Promise.all([weekMasses(db, row.weekStart), listChurches()]);

    const out = await extractDraft({ bytes, kind, weekStart: row.weekStart, masses, churches });
    if (out.status === "draft") await finish({ status: "draft", draft: out.draft, error: null });
    else await finish({ status: "unreadable", draft: null, error: out.reason });
  } catch (e) {
    const busy = e instanceof AiBusyError;
    if (!busy) console.error("[bulletin] reading failed", e);
    await finish({ status: "ai_busy", draft: null, error: busy ? "ai_busy" : String((e as Error)?.message ?? e).slice(0, 500) }).catch(() => {});
  }
}
