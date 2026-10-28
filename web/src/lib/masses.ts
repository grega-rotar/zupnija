import type {
  MASS_DAYS_QUERY_RESULT,
  MASS_SCHEDULES_QUERY_RESULT,
} from "@/sanity/types.generated";
import {
  addDays,
  compareTime,
  dateRange,
  normaliseTime,
  weekdayOf,
  type IsoDate,
} from "./dates";

/**
 * Turns the parish's recurring schedules and explicit "Mass days" into a
 * concrete list of Masses per calendar day.
 *
 * Rules (kept deliberately simple so the pastor can predict them):
 *  1. Undated schedules are the regular schedule.
 *  2. A dated schedule valid on the day is added; if it has
 *     `replacesRegular`, the regular schedule is dropped for that day.
 *  3. A »Mašni dan« for the day: with `replacesSchedule` its Masses are the
 *     only Masses. Otherwise each of its Masses either enriches a scheduled
 *     Mass with the same time + church (intentions, note, cancellation,
 *     celebrant) or is added as an extra Mass.
 */

export type ChurchRef = { _id: string; name: string; shortName: string; slug: string };

export type Intention = { _key: string; kind: string | null; text: string };

export type MassType = NonNullable<
  MASS_SCHEDULES_QUERY_RESULT[number]["entries"][number]["type"]
>;

export type Mass = {
  key: string;
  time: string;
  church: ChurchRef | null;
  type: MassType;
  status: "scheduled" | "cancelled" | "changed";
  statusNote: string | null;
  note: string | null;
  celebrant: { name: string; roleTitle: string | null } | null;
  intentions: Intention[];
  /** True when the Mass comes from the recurring schedule (possibly enriched). */
  recurring: boolean;
};

export type MassDay = {
  date: IsoDate;
  liturgicalTitle: string | null;
  /** Sundays: the Sunday's name from the bulletin (calendar_days), e.g. "28. navadna nedelja". */
  sundayName?: string | null;
  /** Sundays: the Gospel line from the bulletin, e.g. "»Kje pa je onih devet?«". */
  gospel?: string | null;
  /** Group tags printed with the day in the bulletin ("MLADINSKA SK."). */
  tags?: string[];
  note: MASS_DAYS_QUERY_RESULT[number]["note"];
  masses: Mass[];
  /** True when a »Mašni dan« exists for this date (intentions were entered). */
  hasExplicitDay: boolean;
};

type Schedule = MASS_SCHEDULES_QUERY_RESULT[number];
type ExplicitDay = MASS_DAYS_QUERY_RESULT[number];

function scheduleAppliesOn(schedule: Schedule, date: IsoDate): boolean {
  if (schedule.validFrom && schedule.validFrom > date) return false;
  if (schedule.validUntil && schedule.validUntil < date) return false;
  return true;
}

function isDated(schedule: Schedule): boolean {
  return Boolean(schedule.validFrom || schedule.validUntil);
}

function massKey(time: string, churchId: string | undefined): string {
  return `${normaliseTime(time)}|${churchId ?? "?"}`;
}

function scheduledMassesFor(date: IsoDate, schedules: Schedule[]): Mass[] {
  const weekday = weekdayOf(date);
  const applicable = schedules.filter((s) => scheduleAppliesOn(s, date));
  const dated = applicable.filter(isDated);
  const replaces = dated.some((s) => s.replacesRegular !== false);
  const active = replaces ? dated : applicable;

  const masses: Mass[] = [];
  for (const schedule of active) {
    for (const entry of schedule.entries ?? []) {
      if (!entry.weekdays?.includes(weekday)) continue;
      masses.push({
        key: `${schedule._id}:${entry._key}`,
        time: normaliseTime(entry.time),
        church: entry.church ?? null,
        type: entry.type ?? "regular",
        status: "scheduled",
        statusNote: null,
        note: entry.note ?? null,
        celebrant: null,
        intentions: [],
        recurring: true,
      });
    }
  }
  return masses;
}

function fromExplicit(mass: NonNullable<ExplicitDay["masses"]>[number]): Mass {
  return {
    key: mass._key,
    time: normaliseTime(mass.time),
    church: mass.church ?? null,
    type: mass.type ?? "regular",
    status: mass.status ?? "scheduled",
    statusNote: mass.statusNote ?? null,
    note: mass.note ?? null,
    celebrant: mass.celebrant ? { name: mass.celebrant.name, roleTitle: mass.celebrant.roleTitle } : null,
    intentions: (mass.intentions ?? []).map((i) => ({ _key: i._key, kind: i.kind ?? null, text: i.text })),
    recurring: false,
  };
}

/**
 * The day's liturgical lines from the bulletin: the title ("Simon in Juda
 * Tadej, apostola"), on Sundays the Sunday's name when it differs from the
 * title, and the Gospel line in italics.
 */
export function dayLines(day: Pick<MassDay, "liturgicalTitle" | "sundayName" | "gospel">): { title: string | null; sunday: string | null; gospel: string | null } {
  const title = day.liturgicalTitle?.trim() || null;
  const sunday = day.sundayName?.trim() || null;
  return { title: title ?? sunday, sunday: sunday && title && sunday !== title ? sunday : null, gospel: day.gospel?.trim() || null };
}

export function buildMassDay(date: IsoDate, schedules: Schedule[], explicit: ExplicitDay | undefined): MassDay {
  const explicitMasses = (explicit?.masses ?? []).map(fromExplicit);

  let masses: Mass[];
  if (explicit?.replacesSchedule) {
    masses = explicitMasses;
  } else {
    const byKey = new Map<string, Mass>();
    for (const m of scheduledMassesFor(date, schedules)) {
      byKey.set(massKey(m.time, m.church?._id), m);
    }
    for (const m of explicitMasses) {
      const key = massKey(m.time, m.church?._id);
      const existing = byKey.get(key);
      if (existing) {
        byKey.set(key, {
          ...existing,
          type: m.type !== "regular" ? m.type : existing.type,
          status: m.status,
          statusNote: m.statusNote,
          note: m.note ?? existing.note,
          celebrant: m.celebrant,
          intentions: m.intentions,
        });
      } else {
        byKey.set(key, m);
      }
    }
    masses = [...byKey.values()];
  }

  masses.sort((a: Mass, b: Mass) => compareTime(a.time, b.time) || (a.church?.shortName ?? "").localeCompare(b.church?.shortName ?? "", "sl"));

  return {
    date,
    liturgicalTitle: explicit?.liturgicalTitle ?? null,
    note: explicit?.note ?? null,
    masses,
    hasExplicitDay: Boolean(explicit),
  };
}

/** Masses for every day in [from, to] (inclusive). */
export function buildMassDays(
  from: IsoDate,
  to: IsoDate,
  schedules: MASS_SCHEDULES_QUERY_RESULT,
  explicitDays: MASS_DAYS_QUERY_RESULT,
): MassDay[] {
  const explicitByDate = new Map(explicitDays.map((d) => [d.date, d]));
  return dateRange(from, to).map((date) => buildMassDay(date, schedules, explicitByDate.get(date)));
}

/** Masses on `date` that have not started yet (or all of them if `time` is undefined). */
export function remainingMasses(day: MassDay, time?: string): Mass[] {
  if (!time) return day.masses;
  return day.masses.filter((m) => compareTime(m.time, time) >= 0);
}

/**
 * Picks what the homepage should show: today's Masses (still ahead), or the
 * next day that has any Mass within `lookahead` days.
 */
export function pickTodayOrNext(
  days: MassDay[],
  todayDate: IsoDate,
  time: string,
): { day: MassDay; masses: Mass[]; isToday: boolean } | null {
  const todayEntry = days.find((d) => d.date === todayDate);
  if (todayEntry) {
    const ahead = remainingMasses(todayEntry, time).filter((m) => m.status !== "cancelled");
    if (ahead.length) return { day: todayEntry, masses: remainingMasses(todayEntry, time), isToday: true };
  }
  let cursor = addDays(todayDate, 1);
  for (const d of days) {
    if (d.date < cursor) continue;
    if (d.masses.some((m) => m.status !== "cancelled")) return { day: d, masses: d.masses, isToday: false };
    cursor = d.date;
  }
  return null;
}

/** Groups weekly schedule entries by church → weekday → entries, for the schedule table. */
export type ScheduleRow = { time: string; type: MassType; note: string | null };

export function scheduleByChurch(schedule: Schedule): Map<string, { church: ChurchRef; days: Map<string, ScheduleRow[]> }> {
  const out = new Map<string, { church: ChurchRef; days: Map<string, ScheduleRow[]> }>();
  for (const entry of schedule.entries ?? []) {
    if (!entry.church) continue;
    const bucket = out.get(entry.church._id) ?? { church: entry.church, days: new Map() };
    for (const weekday of entry.weekdays ?? []) {
      const rows = bucket.days.get(weekday) ?? [];
      rows.push({ time: normaliseTime(entry.time), type: entry.type ?? "regular", note: entry.note ?? null });
      rows.sort((a: ScheduleRow, b: ScheduleRow) => compareTime(a.time, b.time));
      bucket.days.set(weekday, rows);
    }
    out.set(entry.church._id, bucket);
  }
  return out;
}

export const MASS_TYPE_LABEL: Record<MassType, string> = {
  regular: "Sveta maša",
  sunday: "Nedeljska sveta maša",
  family: "Družinska sveta maša",
  children: "Otroška sveta maša",
  youth: "Mladinska sveta maša",
  evening: "Večerna sveta maša",
  feast: "Praznična sveta maša",
  funeral: "Pogrebna sveta maša",
  wedding: "Poročna sveta maša",
  midnight: "Božična polnočnica",
  vigil: "Velikonočna vigilija",
  other: "Bogoslužje",
};

export const INTENTION_PREFIX: Record<string, string> = {
  deceased: "†",
};
