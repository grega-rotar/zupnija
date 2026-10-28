/**
 * The data the assistant sees: everything the signed-in person can see in the
 * editor, section by section, and nothing more (US-013). Everything a
 * proposal may point at (mass, intention, event, person and change request
 * ids, group ids + dates) must come from here; ask.ts drops anything else
 * (FR-12).
 *
 * Token budget: the DATA block is JSON in the prompt on every turn. With the
 * seed data the owner's context is ~16k characters (~5.5k tokens; the whole prompt ~25k); keep it under
 * 32k characters (~11k tokens, see assistant.test.ts) by summarising counts
 * and listing only the rows a question or proposal is likely to need:
 *   masses + intentions   this week and the next 8 weeks, empty fields left out
 *   lessons               this week and the next 8 weeks
 *   events                the last 30 days and up to 30 upcoming, descriptions cut
 *   bulletins             the newest 8
 *   pending, history      up to 20 / 15 rows
 *   people                everyone with access (owner only)
 */
import "server-only";
import { and, asc, eq, gte, inArray, lte } from "drizzle-orm";
import { db as defaultDb, schema, type Db } from "@/db";
import { listPending } from "@/lib/admin/engine";
import { listBulletins, type BulletinListEntry } from "@/lib/bulletin/service";
import { can, needsApproval, SECTIONS, type Actor, type Section } from "@/lib/admin/sections";
import { nowTime, today, weekStart } from "@/lib/clock";
import { addDays, WEEKDAY_LABEL, weekdayOf } from "@/lib/dates";
import { listPeople } from "@/lib/ljudje/queries";
import { ensureMasses } from "@/lib/mase/ensure";
import { listHistory } from "@/lib/zgodovina/queries";
import { clock, lastSeen, ymd } from "@/lib/zgodovina/time";

export const PROPOSAL_TYPES = [
  "add_intention",
  "remove_intention",
  "cancel_mass",
  "restore_mass",
  "cancel_lesson",
  "restore_lesson",
  "event",
  "edit_event",
  "delete_event",
  "open_upload",
  "invite_person",
  "update_access",
  "approve_change",
  "reject_change",
] as const;
export type ProposalType = (typeof PROPOSAL_TYPES)[number];

/** How far ahead masses and lessons go: this week and the next 8 (FR-7). */
const WEEKS_AHEAD = 8;
const EVENTS_BACK_DAYS = 30;
const EVENTS_AHEAD = 30;
const BULLETINS = 8;
const PENDING = 20;
const HISTORY = 15;
const DESCRIPTION = 160;

export type CtxIntention = { id: number; kind: "deceased" | "thanksgiving" | "other"; text: string };
export type CtxMass = {
  massId: number;
  date: string;
  weekday: string;
  time: string;
  church: string;
  status: "scheduled" | "cancelled";
  cancelReason?: string;
  /** Only present (true) when the Mass is over. */
  past?: true;
  /** Left out when the Mass has no intention. */
  intentions?: CtxIntention[];
};
export type CtxLesson = {
  groupId: number;
  name: string;
  date: string;
  weekday: string;
  time: string;
  place: string;
  cancelled: boolean;
  /** The message to parents of a cancelled lesson. */
  message?: string;
  past?: true;
};
export type CtxEvent = {
  id: number;
  title: string;
  date: string;
  weekday: string;
  time: string;
  place: string;
  description?: string;
  onFrontPage?: true;
  past?: true;
};
export type CtxBulletin = { id: number | null; from: string; to: string; title?: string; status: string; notices: number; items: number; flags: number };
export type CtxPending = { changeRequestId: number; section: string; label: string; by: string; at: string };
export type CtxHistory = { id: number; at: string; who: string; label: string; section: string; undone?: true };
export type CtxPerson = {
  userId: string;
  name: string;
  title: string;
  email: string;
  isOwner?: true;
  sections: Section[];
  needsApproval: boolean;
  /** "povabljen, še ni prijavljen" or the last sign-in day. */
  status: string;
};
export type CtxParish = {
  churches: { name: string; short: string }[];
  schedule: { weekdays: string[]; time: string; church: string; note?: string }[];
};

export type AssistantContext = {
  today: string;
  weekday: string;
  time: string;
  thisWeek: { from: string; to: string };
  nextWeek: { from: string; to: string };
  /** The person's own access. */
  me: { name: string; title: string; isOwner: boolean; sections: Section[]; needsApproval: boolean };
  /** Proposal types this person may receive. */
  allowed: ProposalType[];
  /** Counts over the lists below, so "koliko …" is answered without counting by hand. */
  summary: Record<string, number>;
  parish?: CtxParish;
  masses?: CtxMass[];
  lessons?: CtxLesson[];
  events?: CtxEvent[];
  bulletins?: CtxBulletin[];
  /** Changes waiting for the owner: all of them for the owner, a helper's own for a helper. */
  pending: CtxPending[];
  /** The newest applied changes the person may see (the Zgodovina screen's filter). */
  history: CtxHistory[];
  /** Owner only: everyone with access. */
  people?: CtxPerson[];
};

const hm = (t: string) => t.slice(0, 5);
const wd = (d: string) => WEEKDAY_LABEL[weekdayOf(d)];
const when = (d: Date) => `${ymd(d)} ${clock(d)}`;
const cut = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);
/** catechesis_groups.weekday is 0 = Sunday, and weeks start on Sunday, so it is the offset in the week. */
const offsetInWeek = (weekday: number) => weekday;
const DAY_NAMES = ["nedelja", "ponedeljek", "torek", "sreda", "četrtek", "petek", "sobota"];

export function allowedTypes(actor: Actor): ProposalType[] {
  const out: ProposalType[] = [];
  if (can(actor, "mase")) out.push("add_intention", "remove_intention", "cancel_mass", "restore_mass");
  if (can(actor, "verouk")) out.push("cancel_lesson", "restore_lesson");
  if (can(actor, "dogodki")) out.push("event", "edit_event");
  // event.delete is owner-only in the engine; person.* and approvals are the owner's.
  if (actor.isOwner) out.push("delete_event");
  if (can(actor, "oznanila")) out.push("open_upload");
  if (can(actor, "ljudje")) out.push("invite_person", "update_access");
  if (actor.isOwner) out.push("approve_change", "reject_change");
  return out;
}

/** One bulletin list entry as the assistant sees it. */
export function bulletinOf(e: BulletinListEntry): CtxBulletin {
  return {
    id: e.id,
    from: e.periodStart,
    to: e.periodEnd,
    ...(e.title ? { title: e.title } : {}),
    status: e.status,
    notices: e.noticeCount,
    items: e.itemCount,
    flags: e.flagCount,
  };
}

export async function buildContext(actor: Actor, dbx: Db = defaultDb): Promise<AssistantContext> {
  const day = today();
  const time = nowTime();
  const start = weekStart(day);
  const end = addDays(start, 6);
  const nextStart = addDays(start, 7);
  const nextEnd = addDays(start, 13);
  const lastDay = addDays(start, 7 * (WEEKS_AHEAD + 1) - 1);
  const isPast = (date: string, t: string) => date < day || (date === day && hm(t) < time);
  const pastFlag = (date: string, t: string) => (isPast(date, t) ? { past: true as const } : {});

  const ctx: AssistantContext = {
    today: day,
    weekday: wd(day),
    time,
    thisWeek: { from: start, to: end },
    nextWeek: { from: nextStart, to: nextEnd },
    me: {
      name: actor.name,
      title: actor.title,
      isOwner: actor.isOwner,
      sections: actor.isOwner ? [...SECTIONS] : actor.sections,
      needsApproval: needsApproval(actor),
    },
    allowed: allowedTypes(actor),
    summary: {},
    pending: [],
    history: [],
  };
  const sum = ctx.summary;

  if (can(actor, "mase")) {
    const churches = await dbx.select().from(schema.churches).orderBy(asc(schema.churches.position));
    const schedule = await dbx.select().from(schema.massScheduleEntries);
    const short = new Map(churches.map((c) => [c.id, c.shortName]));
    ctx.parish = {
      churches: churches.map((c) => ({ name: c.name, short: c.shortName })),
      schedule: schedule
        .filter((s) => !s.validUntil || s.validUntil >= day)
        .sort((a, b) => (a.weekdays[0] ?? 0) - (b.weekdays[0] ?? 0) || a.time.localeCompare(b.time))
        .map((s) => ({ weekdays: s.weekdays.map((w) => DAY_NAMES[w]), time: hm(s.time), church: short.get(s.churchId) ?? "", ...(s.note ? { note: s.note } : {}) })),
    };

    // The same generation the Masses screen and the "Nov namen" picker do (FR-7).
    await ensureMasses(dbx, start, lastDay);
    const m = schema.masses;
    const rows = await dbx
      .select({ id: m.id, date: m.date, time: m.time, status: m.status, cancelReason: m.cancelReason, church: schema.churches.shortName })
      .from(m)
      .innerJoin(schema.churches, eq(schema.churches.id, m.churchId))
      .where(and(gte(m.date, start), lte(m.date, lastDay)))
      .orderBy(asc(m.date), asc(m.time), asc(schema.churches.position));
    const ids = rows.map((r) => r.id);
    const ints = ids.length
      ? await dbx
          .select()
          .from(schema.intentions)
          .where(inArray(schema.intentions.massId, ids))
          .orderBy(asc(schema.intentions.position), asc(schema.intentions.id))
      : [];
    ctx.masses = rows.map((r) => {
      const list = ints.filter((i) => i.massId === r.id).map((i) => ({ id: i.id, kind: i.kind, text: i.text }));
      return {
        massId: r.id,
        date: r.date,
        weekday: wd(r.date),
        time: hm(r.time),
        church: r.church,
        status: r.status,
        ...(r.cancelReason ? { cancelReason: r.cancelReason } : {}),
        ...pastFlag(r.date, r.time),
        ...(list.length ? { intentions: list } : {}),
      };
    });
    const thisWeek = ctx.masses.filter((x) => x.date <= end);
    sum.massesThisWeek = thisWeek.length;
    sum.massesThisWeekWithoutIntention = thisWeek.filter((x) => x.status === "scheduled" && !x.intentions).length;
    sum.massesListed = ctx.masses.length;
    sum.massesCancelled = ctx.masses.filter((x) => x.status === "cancelled").length;
    sum.intentionsListed = ints.length;
  }

  if (can(actor, "verouk")) {
    const groups = await dbx.select().from(schema.catechesisGroups).orderBy(asc(schema.catechesisGroups.position), asc(schema.catechesisGroups.id));
    const c = schema.catechesisCancellations;
    const cancels = await dbx.select({ groupId: c.groupId, date: c.date, message: c.message }).from(c).where(and(gte(c.date, start), lte(c.date, lastDay)));
    const lessons: CtxLesson[] = [];
    for (let w = 0; w <= WEEKS_AHEAD; w++) {
      const from = addDays(start, 7 * w);
      for (const g of groups) {
        const date = addDays(from, offsetInWeek(g.weekday));
        const cancel = cancels.find((x) => x.groupId === g.id && x.date === date);
        lessons.push({
          groupId: g.id,
          name: g.name,
          date,
          weekday: wd(date),
          time: hm(g.time),
          place: g.place,
          cancelled: !!cancel,
          ...(cancel?.message ? { message: cancel.message } : {}),
          ...pastFlag(date, g.time),
        });
      }
    }
    ctx.lessons = lessons.sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
    sum.veroukGroups = groups.length;
    sum.lessonsCancelled = lessons.filter((l) => l.cancelled).length;
  }

  if (can(actor, "dogodki")) {
    const e = schema.events;
    // Named columns only: the events table gains columns from other changes.
    const cols = { id: e.id, title: e.title, date: e.date, time: e.time, place: e.place, description: e.description, onFrontPage: e.onFrontPage };
    const back = addDays(day, -EVENTS_BACK_DAYS);
    const past = await dbx.select(cols).from(e).where(and(gte(e.date, back), lte(e.date, addDays(day, -1)))).orderBy(asc(e.date), asc(e.time));
    const upcoming = await dbx.select(cols).from(e).where(gte(e.date, day)).orderBy(asc(e.date), asc(e.time)).limit(EVENTS_AHEAD);
    ctx.events = [...past, ...upcoming].map((r) => ({
      id: r.id,
      title: r.title,
      date: r.date,
      weekday: wd(r.date),
      time: hm(r.time),
      place: r.place,
      ...(r.description ? { description: cut(r.description, DESCRIPTION) } : {}),
      ...(r.onFrontPage ? { onFrontPage: true as const } : {}),
      ...pastFlag(r.date, r.time),
    }));
    sum.eventsUpcoming = upcoming.length;
    sum.eventsLast30Days = past.length;
  }

  if (can(actor, "oznanila")) {
    const list = await listBulletins();
    ctx.bulletins = list.map(bulletinOf).slice(0, BULLETINS);
    sum.bulletinsPublished = list.filter((b) => b.status === "published").length;
  }

  const pending = await listPending(dbx, actor.isOwner ? undefined : actor.id);
  const byIds = [...new Set(pending.map((p) => p.createdBy))];
  const names = new Map(
    byIds.length ? (await dbx.select({ id: schema.user.id, name: schema.user.name }).from(schema.user).where(inArray(schema.user.id, byIds))).map((u) => [u.id, u.name]) : [],
  );
  ctx.pending = pending.slice(0, PENDING).map((p) => ({
    changeRequestId: p.id,
    section: p.section,
    label: p.label,
    by: names.get(p.createdBy) ?? p.createdBy,
    at: when(p.createdAt),
  }));
  sum.pending = pending.length;

  const days = await listHistory(actor, { limit: HISTORY }, dbx);
  ctx.history = days.flatMap((d) =>
    d.entries.map((h) => ({
      id: h.id,
      at: `${d.key} ${h.at}`,
      who: h.who?.name ?? "",
      label: h.note ? `${h.label} (${h.note})` : h.label,
      section: h.section,
      ...(h.undone ? { undone: true as const } : {}),
    })),
  );

  if (can(actor, "ljudje")) {
    const people = await listPeople(dbx);
    ctx.people = people.map((p) => ({
      userId: p.id,
      name: p.name,
      title: p.title,
      email: p.email,
      ...(p.isOwner ? { isOwner: true as const } : {}),
      sections: p.sections,
      needsApproval: p.requiresApproval,
      status: p.invited ? "povabljen, še ni prijavljen" : p.lastSeenAt ? `nazadnje ${lastSeen(p.lastSeenAt)}` : "še ni prijavljen",
    }));
    sum.peopleWithAccess = people.length;
    sum.peopleInvitedNotSignedIn = people.filter((p) => p.invited).length;
  }

  return ctx;
}
