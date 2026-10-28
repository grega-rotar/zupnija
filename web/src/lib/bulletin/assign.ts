/**
 * The server, not the model, decides which Mass an intention belongs to
 * (contract "Mapping intentions to Masses"). Pure: the caller passes the
 * period's generated Masses.
 *
 * For each day, the day's Masses sorted by time: the i-th intention goes to
 * the i-th Mass, extra intentions to the day's last Mass (a Mass can have
 * several). On a Sunday that is line 1 → 8.00 Sv. Križ, line 2 → 10.00
 * Marijina cerkev.
 *
 * An intention whose time (and church) was printed on the sheet (weekly or
 * handwritten sheets, spreadsheets) goes to that Mass instead; when there is
 * no such Mass, flagScheduleMismatches (flags.ts) asks.
 *
 * A day with intentions but no scheduled Mass (a feast, an override) gets a
 * "time" flag on each intention, offering the times this weekday usually has.
 */
import { formatTime } from "@/lib/dates";
import type { BulletinFlag, DraftDay, PeriodMass } from "./types";

const t5 = (t: string) => t.slice(0, 5);
const uniq = <T,>(xs: T[]) => [...new Set(xs)];
const weekday = (d: string) => new Date(`${d}T12:00:00Z`).getUTCDay();

/** An intention before assignment: time and church only when printed. */
export type UnassignedIntention = Omit<DraftDay["intentions"][number], "time" | "churchSlug"> & { time?: string; churchSlug?: string };
export type UnassignedDay = Omit<DraftDay, "intentions"> & { intentions: UnassignedIntention[] };

/** Masses usually held on the weekday of `date` (from the rest of the period), else every time of the period. */
function usualMasses(date: string, masses: PeriodMass[]): PeriodMass[] {
  const sameWeekday = masses.filter((m) => weekday(m.date) === weekday(date));
  const pool = sameWeekday.length ? sameWeekday : masses;
  const seen = new Set<string>();
  return [...pool]
    .sort((a, b) => a.time.localeCompare(b.time))
    .filter((m) => {
      const k = `${t5(m.time)}|${m.churchSlug}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
}

export function noMassFlag(date: string, masses: PeriodMass[]): BulletinFlag {
  const usual = usualMasses(date, masses);
  const times = uniq(usual.map((m) => t5(m.time)));
  return {
    field: "time",
    question: times.length
      ? `Ta dan po urniku ni maše. Ob kateri uri bo maša (običajno ob ${times.map(formatTime).join(" ali ")})?`
      : "Ta dan po urniku ni maše. Ob kateri uri bo maša?",
    options: times.length ? times : ["18:30"],
  };
}

export function assignMasses(days: UnassignedDay[], masses: PeriodMass[], fallbackChurch: string): DraftDay[] {
  return days.map((day) => {
    const onDay = masses.filter((m) => m.date === day.date).sort((a, b) => a.time.localeCompare(b.time));
    let n = 0; // index among the intentions without a printed time
    const intentions = day.intentions.map((it) => {
      if (it.time) {
        const printed = t5(it.time);
        const hit = onDay.find((m) => t5(m.time) === printed && (!it.churchSlug || m.churchSlug === it.churchSlug));
        const church = it.churchSlug ?? hit?.churchSlug ?? onDay.find((m) => t5(m.time) === printed)?.churchSlug ?? onDay[0]?.churchSlug ?? fallbackChurch;
        return { ...it, time: printed, churchSlug: church };
      }
      if (!onDay.length) {
        const flag = noMassFlag(day.date, masses);
        const usual = usualMasses(day.date, masses)[0];
        return { ...it, time: flag.options[0], churchSlug: it.churchSlug ?? usual?.churchSlug ?? fallbackChurch, flag };
      }
      const mass = onDay[Math.min(n++, onDay.length - 1)];
      return { ...it, time: t5(mass.time), churchSlug: mass.churchSlug };
    });
    return { ...day, intentions };
  });
}
