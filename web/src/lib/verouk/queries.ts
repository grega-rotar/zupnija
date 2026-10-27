/**
 * Verouk for the editor: each group's lesson in a given week, whether it is
 * cancelled (with the message for parents), and pending helper proposals.
 */
import { and, asc, eq, gte, inArray, lte } from "drizzle-orm";
import { db as defaultDb, schema, type Db } from "@/db";
import { nowTime, today, weekStart as mondayOf } from "@/lib/clock";
import type { LessonCancelPayload } from "./actions";

export type Lesson = {
  groupId: number;
  name: string; // "4.–6. razred"
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  place: string;
  kids: number;
  cancelled: boolean;
  /** Message for parents when cancelled ("" otherwise). */
  message: string;
  /** A helper's lesson.cancel / lesson.restore waiting for the owner. */
  pending: { changeRequestId: number; action: "lesson.cancel" | "lesson.restore"; message: string; by: string; byName: string; at: Date } | null;
};

const addDays = (iso: string, n: number) => {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

/** Lessons of every group in the week starting on Monday `weekStart`, ordered by date and time. */
export async function getLessons(weekStart: string, dbx: Db = defaultDb): Promise<Lesson[]> {
  const monday = mondayOf(weekStart);
  const sunday = addDays(monday, 6);
  const groups = await dbx.select().from(schema.catechesisGroups).orderBy(asc(schema.catechesisGroups.position), asc(schema.catechesisGroups.id));
  if (!groups.length) return [];
  const c = schema.catechesisCancellations;
  const cancels = await dbx
    .select()
    .from(c)
    .where(and(gte(c.date, monday), lte(c.date, sunday), inArray(c.groupId, groups.map((x) => x.id))));
  const cr = schema.changeRequests;
  const pend = await dbx
    .select({ id: cr.id, action: cr.action, payload: cr.payload, createdBy: cr.createdBy, createdAt: cr.createdAt, byName: schema.user.name })
    .from(cr)
    .innerJoin(schema.user, eq(schema.user.id, cr.createdBy))
    .where(and(eq(cr.status, "pending"), inArray(cr.action, ["lesson.cancel", "lesson.restore"])))
    .orderBy(asc(cr.createdAt));

  return groups
    .map((grp): Lesson => {
      const date = addDays(monday, (grp.weekday + 6) % 7);
      const cancel = cancels.find((x) => x.groupId === grp.id && x.date === date);
      const p = pend.filter((x) => {
        const pl = x.payload as LessonCancelPayload;
        return pl.groupId === grp.id && pl.date === date;
      }).pop();
      return {
        groupId: grp.id,
        name: grp.name,
        date,
        time: grp.time.slice(0, 5),
        place: grp.place,
        kids: grp.kids,
        cancelled: !!cancel,
        message: cancel?.message ?? "",
        pending: p
          ? {
              changeRequestId: p.id,
              action: p.action as "lesson.cancel" | "lesson.restore",
              message: (p.payload as LessonCancelPayload).message ?? "",
              by: p.createdBy,
              byName: p.byName,
              at: p.createdAt,
            }
          : null,
      };
    })
    .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
}

/** The next lesson that hasn't started yet (this week or next), cancelled or not; null if there are no groups. */
export async function getNextLesson(dbx: Db = defaultDb): Promise<Lesson | null> {
  const d = today(), t = nowTime();
  const monday = mondayOf(d);
  const lessons = [...(await getLessons(monday, dbx)), ...(await getLessons(addDays(monday, 7), dbx))];
  return lessons.find((l) => l.date > d || (l.date === d && l.time >= t)) ?? null;
}
