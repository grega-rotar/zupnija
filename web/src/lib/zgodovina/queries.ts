/**
 * The "Zgodovina" screen: applied changes, newest first, grouped by day.
 * The owner sees everything; a helper sees entries in their own sections
 * plus whatever they did themselves.
 */
import { desc, eq, inArray, or } from "drizzle-orm";
import { db as defaultDb, schema, type Db } from "@/db";
import type { Actor } from "@/lib/admin/sections";
import { now } from "@/lib/clock";
import { clock, dayLabel, ymd } from "./time";

export type HistoryEntry = {
  id: number;
  /** "8.15" */
  at: string;
  label: string;
  note: string | null;
  who: { id: string; name: string; short: string; isOwner: boolean } | null;
  section: string;
  /** This change was undone later (a "razveljavljeno" pill). */
  undone: boolean;
  /** The actor may try to undo it (author or owner, not undone, not itself an undo). */
  canUndo: boolean;
};
export type HistoryDay = { key: string; label: string; entries: HistoryEntry[] };

export async function listHistory(actor: Actor, opts: { limit?: number } = {}, dbx: Db = defaultDb): Promise<HistoryDay[]> {
  const h = schema.history, u = schema.user;
  const visible = actor.isOwner
    ? undefined
    : actor.sections.length
      ? or(inArray(h.section, actor.sections), eq(h.userId, actor.id))
      : eq(h.userId, actor.id);
  const rows = await dbx
    .select({
      id: h.id,
      userId: h.userId,
      section: h.section,
      action: h.action,
      label: h.label,
      note: h.note,
      undoneAt: h.undoneAt,
      createdAt: h.createdAt,
      name: u.name,
      short: u.short,
      isOwner: u.isOwner,
    })
    .from(h)
    .leftJoin(u, eq(u.id, h.userId))
    .where(visible)
    .orderBy(desc(h.createdAt), desc(h.id))
    .limit(opts.limit ?? 100);

  // approve() stores "predlog: <user id>"; show the person's name instead.
  const ids = [...new Set(rows.map((r) => /^predlog: (.+)$/.exec(r.note ?? "")?.[1]).filter((x): x is string => !!x))];
  const names = new Map(
    ids.length ? (await dbx.select({ id: u.id, name: u.name }).from(u).where(inArray(u.id, ids))).map((x) => [x.id, x.name]) : [],
  );

  const ref = now();
  const days: HistoryDay[] = [];
  for (const r of rows) {
    const key = ymd(r.createdAt);
    let day = days[days.length - 1];
    if (!day || day.key !== key) days.push((day = { key, label: dayLabel(r.createdAt, ref), entries: [] }));
    const isUndo = r.action === "undo";
    const proposer = /^predlog: (.+)$/.exec(r.note ?? "")?.[1];
    day.entries.push({
      id: r.id,
      at: clock(r.createdAt),
      label: r.label,
      note: proposer ? `predlog: ${names.get(proposer) ?? proposer}` : r.note,
      who: r.userId && r.name != null ? { id: r.userId, name: r.name, short: r.short ?? "?", isOwner: !!r.isOwner } : null,
      section: r.section,
      undone: !isUndo && r.undoneAt != null,
      canUndo: !isUndo && r.undoneAt == null && (actor.isOwner || r.userId === actor.id),
    });
  }
  return days;
}
