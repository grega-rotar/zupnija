/**
 * Domov ("Na vrsti"): everything the home screen shows for one person, as a
 * plain view model (US-004). The page only renders it.
 *
 *   loadHome(actor) → greeting, hero (next Mass / next lesson), the owner's
 *   approvals, a helper's own pending items, the bulletin task, Masses
 *   without an intention, cancelled lessons, quick tiles and "Urejeno".
 */
import "server-only";
import { eq, inArray } from "drizzle-orm";
import { db as defaultDb, schema, type Db } from "@/db";
import { listPending } from "@/lib/admin/engine";
import { can, SECTION_LABEL, type Actor, type Section } from "@/lib/admin/sections";
import { listBulletins } from "@/lib/bulletin/service";
import { allIntentions, missingPeriod, periodLabel, readableDraftSchema } from "@/lib/bulletin/types";
import { now, nowTime, today, weekStart as weekStartOf } from "@/lib/clock";
import { addDays } from "@/lib/dates";
import { dayLabel, kindPrefix, timeLabel, weekdayLabel } from "@/lib/mase/format";
import { getMass, getMassesWithoutIntention, getNextMass } from "@/lib/mase/queries";
import { getLessons, type Lesson } from "@/lib/verouk/queries";
import { pl, firstName, relativeDay, relativeStamp, OBVESTILO, NAMEN, OTROK } from "./format";

export type HomeHero =
  | { kind: "mass"; massId: number; time: string; label: string; place: string; detail: string; note: string }
  | { kind: "lesson"; time: string; label: string; place: string; detail: string; note: string };

/** One change request as a row: "Nov namen † Ivana Kos" / "nedelja, 1. november, 8.00, Sv. Križ". */
export type ApprovalRow = {
  id: number;
  what: string;
  where: string;
  /** The reason a helper gave (cancelled Mass, cancelled lesson), shown in italics. */
  note: string | null;
  by: string;
  byName: string;
  /** "včeraj ob 19.42" */
  at: string;
};

export type HomeView = {
  greeting: { eyebrow: string; name: string; sub: string };
  hero: HomeHero | null;
  nextMass: { id: number; date: string; time: string; church: string; intentions: string[] } | null;
  approvals: ApprovalRow[];
  mine: ApprovalRow[];
  /**
   * The month's bulletin while it still has to be uploaded or checked.
   * `week` is the period's first day ("2026-11-01"), `span` the month ("november 2026").
   */
  bulletin: { id: number | null; week: string; span: string; status: "missing" | "draft" } | null;
  bulletinMissing: { week: string } | null;
  massesWithoutIntention: { id: number; date: string; time: string; church: string; line: string }[];
  cancelledLessons: { name: string; date: string; line: string }[];
  can: { mase: boolean; oznanila: boolean; dogodki: boolean; verouk: boolean };
  done: string[];
};

const isLater = (date: string, time: string) => date > today() || (date === today() && time > nowTime());

/** "november 2026" for a month; "25.–31. oktober 2026" for a week or another span. */
const spanOf = (b: { periodStart: string; periodEnd: string }) => periodLabel(b.periodStart, b.periodEnd);

// ── The "where" line of a change request ────────────────────────────────────
type Cr = typeof schema.changeRequests.$inferSelect;
type Described = { what: string; where: string; note: string | null };

async function massWhere(massId: number, dbx: Db): Promise<string | null> {
  const m = await getMass(massId, dbx);
  return m ? `${m.label}, ${timeLabel(m.time)}, ${m.church}` : null;
}

async function describe(cr: Cr, dbx: Db): Promise<Described> {
  const p = (cr.payload ?? {}) as Record<string, unknown>;
  const fallback: Described = { what: cr.label, where: SECTION_LABEL[cr.section as Section] ?? "", note: null };
  switch (cr.action) {
    case "intention.add":
    case "mass.restore": {
      const where = typeof p.massId === "number" ? await massWhere(p.massId, dbx) : null;
      return { ...fallback, where: where ?? fallback.where };
    }
    case "mass.cancel": {
      const where = typeof p.massId === "number" ? await massWhere(p.massId, dbx) : null;
      const reason = typeof p.reason === "string" && p.reason.trim() ? p.reason.trim() : null;
      return { what: "Odpoved maše", where: where ?? fallback.where, note: reason };
    }
    case "intention.remove": {
      if (typeof p.intentionId !== "number") return fallback;
      const [it] = await dbx.select({ massId: schema.intentions.massId }).from(schema.intentions).where(eq(schema.intentions.id, p.intentionId));
      const where = it ? await massWhere(it.massId, dbx) : null;
      return { ...fallback, where: where ?? fallback.where };
    }
    case "event.save": {
      if (typeof p.date !== "string" || typeof p.time !== "string") return fallback;
      const place = typeof p.place === "string" && p.place ? `, ${p.place}` : "";
      return { ...fallback, where: `${dayLabel(p.date)}, ${timeLabel(p.time)}${place}` };
    }
    case "lesson.cancel":
    case "lesson.restore": {
      if (typeof p.groupId !== "number" || typeof p.date !== "string") return fallback;
      const [g] = await dbx.select().from(schema.catechesisGroups).where(eq(schema.catechesisGroups.id, p.groupId));
      const msg = typeof p.message === "string" && p.message.trim() ? p.message.trim() : null;
      return {
        ...fallback,
        where: g ? `${dayLabel(p.date)}, ${timeLabel(g.time)}, ${g.name}` : dayLabel(p.date),
        note: cr.action === "lesson.cancel" ? msg : null,
      };
    }
    case "bulletin.publish": {
      if (typeof p.bulletinId !== "number") return fallback;
      const [b] = await dbx.select().from(schema.bulletins).where(eq(schema.bulletins.id, p.bulletinId));
      if (!b) return fallback;
      const draft = readableDraftSchema.safeParse(b.draft);
      const items = draft.success ? allIntentions(draft.data).length : 0;
      const notices = draft.success ? draft.data.notices.length : 0;
      return {
        what: `Oznanila za ${spanOf(b)}`,
        where: `${pl(items, NAMEN)}, ${pl(notices, OBVESTILO)}`,
        note: null,
      };
    }
    default:
      return fallback;
  }
}

async function toRows(list: Cr[], dbx: Db): Promise<ApprovalRow[]> {
  if (!list.length) return [];
  const ids = [...new Set(list.map((c) => c.createdBy))];
  const users = await dbx.select({ id: schema.user.id, name: schema.user.name }).from(schema.user).where(inArray(schema.user.id, ids));
  const name = new Map(users.map((u) => [u.id, u.name]));
  return Promise.all(
    list.map(async (cr) => ({
      id: cr.id,
      ...(await describe(cr, dbx)),
      by: cr.createdBy,
      byName: name.get(cr.createdBy) ?? cr.createdBy,
      at: relativeStamp(cr.createdAt, now()),
    })),
  );
}

// ── Lessons (this week and next) ────────────────────────────────────────────
async function lessonsAround(dbx: Db): Promise<Lesson[]> {
  const start = weekStartOf(today());
  return [...(await getLessons(start, dbx)), ...(await getLessons(addDays(start, 7), dbx))];
}

// ── loadHome ────────────────────────────────────────────────────────────────
export async function loadHome(actor: Actor, dbx: Db = defaultDb): Promise<HomeView> {
  const c = { mase: can(actor, "mase"), oznanila: can(actor, "oznanila"), dogodki: can(actor, "dogodki"), verouk: can(actor, "verouk") };
  const d = today();
  const thisWeek = weekStartOf(d);

  const greeting = {
    eyebrow: dayLabel(d),
    name: actor.isOwner ? "gospod župnik" : firstName(actor.name),
    sub: actor.isOwner
      ? "Tole je na vrsti ta teden."
      : c.mase
        ? "Tole je na vrsti ta teden. Spremembe pregleda župnik."
        : "Tole je na vrsti pri verouku.",
  };

  // Hero: the next Mass, or for catechists the next lesson that takes place.
  let hero: HomeHero | null = null;
  let nextMass: HomeView["nextMass"] = null;
  let lessons: Lesson[] | null = null;
  if (c.mase) {
    const m = await getNextMass(dbx);
    if (m) {
      const intentions = [...m.intentions, ...m.pending].map((i) => `${kindPrefix(i.kind)} ${i.text}`);
      nextMass = { id: m.id, date: m.date, time: m.time, church: m.church, intentions };
      hero = {
        kind: "mass",
        massId: m.id,
        time: timeLabel(m.time),
        label: `Naslednja maša · ${relativeDay(m.date, d)}`,
        place: m.church,
        detail: m.type === "sunday" ? "nedeljska" : "sveta maša",
        note: intentions.length ? intentions.join(" · ") : "še brez namena",
      };
    }
  } else if (c.verouk) {
    lessons = await lessonsAround(dbx);
    const g = lessons.find((l) => !l.cancelled && isLater(l.date, l.time));
    if (g) {
      hero = {
        kind: "lesson",
        time: timeLabel(g.time),
        label: `Naslednja ura verouka · ${relativeDay(g.date, d)}`,
        place: g.name,
        detail: pl(g.kids, OTROK),
        note: g.place,
      };
    }
  }

  // Change requests: the owner decides all of them; a helper sees her own.
  const approvals = actor.isOwner ? await toRows(await listPending(dbx), dbx) : [];
  const mine = actor.isOwner ? [] : await toRows(await listPending(dbx, actor.id), dbx);

  // The missing month's bulletin (contract "Missing-bulletin logic"): from the
  // 20th of the previous month, and always when the current month has none.
  // A draft of it shows as "čaka pregled". ("Urejeno" lists published bulletins
  // still running, for everyone, as in the prototype.)
  const list = await listBulletins();
  const next = missingPeriod(d, list.filter((b) => b.id != null));
  const e = list.find((b) => b.periodStart === next.start);
  const bulletin: HomeView["bulletin"] =
    c.oznanila && e && (e.status === "draft" || (e.status === "missing" && next.due))
      ? { id: e.id, week: next.start, span: periodLabel(next.start, next.end), status: e.status }
      : null;
  const published = list
    .filter((b) => b.status === "published" && b.periodEnd >= d)
    .sort((a, b) => a.periodStart.localeCompare(b.periodStart))
    .map((b) => `Oznanila za ${spanOf(b)} so objavljena`);

  // Masses still ahead this week with no intention (a pending one counts).
  const massesWithoutIntention = c.mase
    ? (await getMassesWithoutIntention(thisWeek, dbx))
        .filter((m) => isLater(m.date, m.time))
        .map((m) => ({ id: m.id, date: m.date, time: m.time, church: m.church, line: `${weekdayLabel(m.date)} ${timeLabel(m.time)}, ${m.church}` }))
    : [];

  // Catechists: lessons cancelled for the rest of this week.
  let cancelledLessons: HomeView["cancelledLessons"] = [];
  if (c.verouk && !c.mase) {
    lessons ??= await lessonsAround(dbx);
    cancelledLessons = lessons
      .filter((l) => l.cancelled && l.date >= d && l.date <= addDays(thisWeek, 6))
      .map((l) => ({ name: l.name, date: l.date, line: `${l.name}, ${weekdayLabel(l.date)}` }));
  }

  const done = [...published];
  if (c.verouk) done.push("Urnik verouka velja do preklica");
  if (c.mase) done.push("Redni urnik maš velja do preklica");

  return {
    greeting,
    hero,
    nextMass,
    approvals,
    mine,
    bulletin,
    bulletinMissing: bulletin?.status === "missing" ? { week: bulletin.week } : null,
    massesWithoutIntention,
    cancelledLessons,
    can: c,
    done,
  };
}
