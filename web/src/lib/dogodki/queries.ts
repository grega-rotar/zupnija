/**
 * Events for the editor's Dogodki screen: upcoming events plus helpers'
 * pending event.save requests (new events and edits), marked as pending.
 */
import { and, asc, eq, gte, inArray } from "drizzle-orm";
import { db as defaultDb, schema, type Db } from "@/db";
import { today } from "@/lib/clock";
import type { EventSavePayload } from "./actions";

export type EventPending = {
  changeRequestId: number;
  /** true = a proposed new event; false = a proposed edit of `id`. */
  isNew: boolean;
  by: string;
  byName: string;
  at: Date;
};

export type EventItem = {
  /** Stable React key: "e12" for an event, "cr7" for a proposed new event. */
  key: string;
  /** null for a proposed new event that doesn't exist yet. */
  id: number | null;
  title: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  place: string;
  description: string;
  onFrontPage: boolean;
  /** Set when a helper's change waits for the owner; the fields above then show the proposal. */
  pending: EventPending | null;
};

export type EventMonth = { month: string; key: string; items: EventItem[] };

const MONTHS = ["januar", "februar", "marec", "april", "maj", "junij", "julij", "avgust", "september", "oktober", "november", "december"];

const hhmm = (t: string) => t.slice(0, 5);
const byWhen = (a: EventItem, b: EventItem) => (a.date + a.time).localeCompare(b.date + b.time);

type EventRow = typeof schema.events.$inferSelect;
const fromRow = (r: EventRow): EventItem => ({
  key: `e${r.id}`,
  id: r.id,
  title: r.title,
  date: r.date,
  time: hhmm(r.time),
  place: r.place,
  description: r.description,
  onFrontPage: r.onFrontPage,
  pending: null,
});

async function pendingSaves(dbx: Db) {
  const cr = schema.changeRequests;
  return dbx
    .select({ id: cr.id, payload: cr.payload, createdBy: cr.createdBy, createdAt: cr.createdAt, byName: schema.user.name })
    .from(cr)
    .innerJoin(schema.user, eq(schema.user.id, cr.createdBy))
    .where(and(eq(cr.status, "pending"), eq(cr.action, "event.save")))
    .orderBy(asc(cr.createdAt));
}

function applyPending(item: EventItem | null, cr: Awaited<ReturnType<typeof pendingSaves>>[number]): EventItem {
  const p = cr.payload as EventSavePayload;
  return {
    key: item?.key ?? `cr${cr.id}`,
    id: p.id ?? null,
    title: p.title,
    date: p.date,
    time: hhmm(p.time),
    place: p.place,
    description: p.description ?? "",
    onFrontPage: p.onFrontPage ?? false,
    pending: { changeRequestId: cr.id, isNew: !p.id, by: cr.createdBy, byName: cr.byName, at: cr.createdAt },
  };
}

/** Upcoming events (date ≥ today), with pending new events and edits, sorted by date and time. */
export async function listEvents(dbx: Db = defaultDb): Promise<EventItem[]> {
  const from = today();
  const rows = await dbx.select().from(schema.events).where(gte(schema.events.date, from));
  const items = new Map<string, EventItem>(rows.map((r) => [`e${r.id}`, fromRow(r)]));
  const crs = await pendingSaves(dbx);

  // A pending edit of an event that is already past today still shows when the proposal moves it forward.
  const missing = crs.map((c) => (c.payload as EventSavePayload).id).filter((id): id is number => !!id && !items.has(`e${id}`));
  if (missing.length) {
    for (const r of await dbx.select().from(schema.events).where(inArray(schema.events.id, missing))) items.set(`e${r.id}`, fromRow(r));
  }

  for (const c of crs) {
    const id = (c.payload as EventSavePayload).id;
    if (id) {
      const cur = items.get(`e${id}`);
      if (cur) items.set(cur.key, applyPending(cur, c));
    } else {
      items.set(`cr${c.id}`, applyPending(null, c));
    }
  }
  return [...items.values()].filter((i) => i.date >= from).sort(byWhen);
}

/** Group a sorted list under month headings ("november"). */
export function groupByMonth(items: EventItem[]): EventMonth[] {
  const out: EventMonth[] = [];
  for (const it of items) {
    const key = it.date.slice(0, 7);
    let g = out[out.length - 1];
    if (!g || g.key !== key) out.push((g = { key, month: MONTHS[Number(key.slice(5, 7)) - 1], items: [] }));
    g.items.push(it);
  }
  return out;
}

/** One event as stored (published values), with a pending edit if a helper proposed one. */
export async function getEvent(id: number, dbx: Db = defaultDb): Promise<(EventItem & { proposed: EventItem | null }) | null> {
  const [row] = await dbx.select().from(schema.events).where(eq(schema.events.id, id));
  if (!row) return null;
  const item = fromRow(row);
  const cr = (await pendingSaves(dbx)).filter((c) => (c.payload as EventSavePayload).id === id).pop();
  return { ...item, proposed: cr ? applyPending(item, cr) : null };
}
