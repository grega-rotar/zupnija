/**
 * The data the assistant sees: only the signed-in person's sections, read
 * straight from the schema. Everything a proposal may point at (mass ids,
 * group ids + dates) must come from here; ask.ts drops anything else (FR-12).
 */
import "server-only";
import { and, asc, eq, gte, inArray, lte } from "drizzle-orm";
import { db as defaultDb, schema, type Db } from "@/db";
import { can, type Actor } from "@/lib/admin/sections";
import { nowTime, today, weekStart } from "@/lib/clock";
import { addDays, WEEKDAY_LABEL, weekdayOf } from "@/lib/dates";

export const PROPOSAL_TYPES = ["add_intention", "cancel_mass", "cancel_lesson", "event", "open_upload"] as const;
export type ProposalType = (typeof PROPOSAL_TYPES)[number];

export type CtxIntention = { kind: "deceased" | "thanksgiving" | "other"; text: string };
export type CtxMass = {
  massId: number;
  date: string;
  weekday: string;
  time: string;
  church: string;
  status: "scheduled" | "cancelled";
  cancelReason?: string;
  past: boolean;
  intentions: CtxIntention[];
};
export type CtxLesson = {
  groupId: number;
  name: string;
  date: string;
  weekday: string;
  time: string;
  place: string;
  cancelled: boolean;
  past: boolean;
};
export type CtxEvent = { title: string; date: string; weekday: string; time: string; place: string };

export type AssistantContext = {
  today: string;
  weekday: string;
  time: string;
  thisWeek: { from: string; to: string };
  nextWeek: { from: string; to: string };
  /** Proposal types this person may receive. */
  allowed: ProposalType[];
  masses?: CtxMass[];
  lessons?: CtxLesson[];
  events?: CtxEvent[];
};

const hm = (t: string) => t.slice(0, 5);
const wd = (d: string) => WEEKDAY_LABEL[weekdayOf(d)];
/** catechesis_groups.weekday is 0 = Sunday, and weeks start on Sunday, so it is the offset in the week. */
const offsetInWeek = (weekday: number) => weekday;

export function allowedTypes(actor: Actor): ProposalType[] {
  const out: ProposalType[] = [];
  if (can(actor, "mase")) out.push("add_intention", "cancel_mass");
  if (can(actor, "verouk")) out.push("cancel_lesson");
  if (can(actor, "dogodki")) out.push("event");
  if (can(actor, "oznanila")) out.push("open_upload");
  return out;
}

export async function buildContext(actor: Actor, dbx: Db = defaultDb): Promise<AssistantContext> {
  const day = today();
  const time = nowTime();
  const start = weekStart(day);
  const end = addDays(start, 6);
  const nextStart = addDays(start, 7);
  const nextEnd = addDays(start, 13);
  const isPast = (date: string, t: string) => date < day || (date === day && hm(t) < time);

  const ctx: AssistantContext = {
    today: day,
    weekday: wd(day),
    time,
    thisWeek: { from: start, to: end },
    nextWeek: { from: nextStart, to: nextEnd },
    allowed: allowedTypes(actor),
  };

  if (can(actor, "mase")) {
    const m = schema.masses;
    const rows = await dbx
      .select({ id: m.id, date: m.date, time: m.time, status: m.status, cancelReason: m.cancelReason, church: schema.churches.shortName })
      .from(m)
      .innerJoin(schema.churches, eq(schema.churches.id, m.churchId))
      .where(and(gte(m.date, start), lte(m.date, nextEnd)))
      .orderBy(asc(m.date), asc(m.time), asc(schema.churches.position));
    const ids = rows.map((r) => r.id);
    const ints = ids.length
      ? await dbx
          .select()
          .from(schema.intentions)
          .where(inArray(schema.intentions.massId, ids))
          .orderBy(asc(schema.intentions.position), asc(schema.intentions.id))
      : [];
    ctx.masses = rows.map((r) => ({
      massId: r.id,
      date: r.date,
      weekday: wd(r.date),
      time: hm(r.time),
      church: r.church,
      status: r.status,
      ...(r.cancelReason ? { cancelReason: r.cancelReason } : {}),
      past: isPast(r.date, r.time),
      intentions: ints.filter((i) => i.massId === r.id).map((i) => ({ kind: i.kind, text: i.text })),
    }));
  }

  if (can(actor, "verouk")) {
    const groups = await dbx.select().from(schema.catechesisGroups).orderBy(asc(schema.catechesisGroups.position), asc(schema.catechesisGroups.id));
    const c = schema.catechesisCancellations;
    const cancels = await dbx.select({ groupId: c.groupId, date: c.date }).from(c).where(and(gte(c.date, start), lte(c.date, nextEnd)));
    const lessons: CtxLesson[] = [];
    for (const from of [start, nextStart]) {
      for (const g of groups) {
        const date = addDays(from, offsetInWeek(g.weekday));
        lessons.push({
          groupId: g.id,
          name: g.name,
          date,
          weekday: wd(date),
          time: hm(g.time),
          place: g.place,
          cancelled: cancels.some((x) => x.groupId === g.id && x.date === date),
          past: isPast(date, g.time),
        });
      }
    }
    ctx.lessons = lessons.sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  }

  if (can(actor, "dogodki")) {
    const e = schema.events;
    const rows = await dbx.select().from(e).where(gte(e.date, day)).orderBy(asc(e.date), asc(e.time)).limit(20);
    ctx.events = rows.map((r) => ({ title: r.title, date: r.date, weekday: wd(r.date), time: hm(r.time), place: r.place }));
  }

  return ctx;
}
