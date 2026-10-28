/**
 * FR-11: after extraction, flag every item whose date, time or church doesn't
 * match one of the week's generated Masses, even when the model was sure.
 * Pure: the caller passes the week's Masses.
 *
 * A schedule mismatch replaces a model flag on the same item (one flag per
 * item): the schedule question decides which Mass the intention goes to.
 */
import { formatTime } from "@/lib/dates";
import type { BulletinFlag, BulletinItem, ReadableDraft, WeekMass } from "./types";

const t5 = (t: string) => t.slice(0, 5);
const uniq = (xs: string[]) => [...new Set(xs)];
const DAY = ["nedeljska", "ponedeljkova", "torkova", "sredina", "četrtkova", "petkova", "sobotna"];
const dayAdj = (date: string) => DAY[new Date(`${date}T12:00:00Z`).getUTCDay()];

export function mismatchFlag(item: BulletinItem, masses: WeekMass[]): BulletinFlag | null {
  const same = (m: WeekMass) => m.date === item.date;
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
  const otherDays = masses.filter((m) => t5(m.time) === item.time && m.churchSlug === item.churchSlug).map((m) => m.date);
  return {
    field: "date",
    question: "Ta dan po urniku ni maše. Je datum pravi?",
    options: uniq([item.date, ...otherDays]),
  };
}

export function flagScheduleMismatches(draft: ReadableDraft, weekMasses: WeekMass[]): ReadableDraft {
  return {
    ...draft,
    items: draft.items.map((item) => {
      const flag = mismatchFlag(item, weekMasses);
      return flag ? { ...item, flag } : item;
    }),
  };
}
