/**
 * Public Verouk groups and lesson cancellations, from Postgres.
 *
 * The rest of the Verouk page (intro, enrollment, contact, documents) stays
 * in Sanity. Pending helper proposals (lesson.cancel / lesson.restore change
 * requests) are never read here: only stored cancellations count.
 */
import "server-only";
import { and, asc, gte, lte } from "drizzle-orm";
import { db, schema } from "@/db";
import { today } from "@/lib/clock";
import { addDays, type IsoDate, type Weekday } from "@/lib/dates";
import { cached, hhmm } from "./cache";

const WEEKDAYS: Weekday[] = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

/** How far ahead a cancellation is announced on the page (days). */
const CANCEL_AHEAD = 14;

export type PublicLessonCancellation = { date: IsoDate; message: string };

export type PublicCatechesisGroup = {
  _id: string;
  title: string;
  sessions: { _key: string; weekday: Weekday; time: string; location: string | null }[];
  /** Upcoming cancelled lessons of this group (today … +14 days), soonest first. */
  cancellations: PublicLessonCancellation[];
};

const load = cached(
  async (from: IsoDate): Promise<PublicCatechesisGroup[]> => {
    const g = schema.catechesisGroups;
    const cc = schema.catechesisCancellations;
    const [groups, cancels] = await Promise.all([
      db.select().from(g).orderBy(asc(g.position), asc(g.id)),
      db
        .select()
        .from(cc)
        .where(and(gte(cc.date, from), lte(cc.date, addDays(from, CANCEL_AHEAD))))
        .orderBy(asc(cc.date)),
    ]);
    return groups.map((grp) => ({
      _id: `group-${grp.id}`,
      title: grp.name,
      sessions: [{ _key: `s${grp.id}`, weekday: WEEKDAYS[grp.weekday], time: hhmm(grp.time), location: grp.place || null }],
      cancellations: cancels.filter((x) => x.groupId === grp.id).map((x) => ({ date: x.date, message: x.message })),
    }));
  },
  "verouk:groups",
  ["verouk"],
);

/** Every Verouk group with its weekly lesson and upcoming cancellations. */
export async function getCatechesisGroups(): Promise<PublicCatechesisGroup[]> {
  return load(today());
}
