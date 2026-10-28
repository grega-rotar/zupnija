/**
 * FR-11: after assignment (assign.ts), flag every intention whose time or
 * church doesn't match one of the day's generated Masses, even when the model
 * was sure. Server-assigned intentions always match; printed times (weekly or
 * handwritten sheets, spreadsheets) may not. Pure: the caller passes the
 * period's Masses.
 *
 * A schedule mismatch replaces a model flag on the same intention (one flag
 * per intention): the schedule question decides which Mass it goes to.
 */
import { formatTime } from "@/lib/dates";
import { noMassFlag } from "./assign";
import type { BulletinFlag, PeriodMass, ReadableDraft } from "./types";

const t5 = (t: string) => t.slice(0, 5);
const uniq = (xs: string[]) => [...new Set(xs)];
const DAY = ["nedeljska", "ponedeljkova", "torkova", "sredina", "četrtkova", "petkova", "sobotna"];
const dayAdj = (date: string) => DAY[new Date(`${date}T12:00:00Z`).getUTCDay()];

export function mismatchFlag(item: { date: string; time: string; churchSlug: string }, masses: PeriodMass[]): BulletinFlag | null {
  const same = (m: PeriodMass) => m.date === item.date;
  if (masses.some((m) => same(m) && t5(m.time) === item.time && m.churchSlug === item.churchSlug)) return null;

  const sameChurch = masses.filter((m) => same(m) && m.churchSlug === item.churchSlug);
  if (sameChurch.length) {
    const times = uniq(sameChurch.map((m) => t5(m.time)));
    const at = times.map(formatTime).join(" ali ");
    return {
      field: "time",
      question: `Na listu piše ${formatTime(item.time)}, po urniku je ${dayAdj(item.date)} maša ob ${at}. Kdaj bo?`,
      options: uniq([item.time, ...times]),
    };
  }
  const sameTime = masses.filter((m) => same(m) && t5(m.time) === item.time);
  if (sameTime.length) {
    return {
      field: "church",
      question: `Po urniku je maša ob ${formatTime(item.time)} v drugi cerkvi. V kateri cerkvi bo?`,
      options: uniq([item.churchSlug, ...sameTime.map((m) => m.churchSlug)]),
    };
  }
  const sameDay = masses.filter(same);
  if (sameDay.length) {
    return {
      field: "time",
      question: `Na listu piše ${formatTime(item.time)}, po urniku je ta dan maša ob ${uniq(sameDay.map((m) => formatTime(t5(m.time)))).join(" ali ")}. Kdaj bo?`,
      options: uniq([item.time, ...sameDay.map((m) => t5(m.time))]),
    };
  }
  return noMassFlag(item.date, masses);
}

export function flagScheduleMismatches(draft: ReadableDraft, masses: PeriodMass[]): ReadableDraft {
  return {
    ...draft,
    days: draft.days.map((day) => ({
      ...day,
      intentions: day.intentions.map((it) => {
        const flag = mismatchFlag({ date: day.date, time: it.time, churchSlug: it.churchSlug }, masses);
        return flag ? { ...it, flag } : it;
      }),
    })),
  };
}
