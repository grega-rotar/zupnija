/**
 * The homepage's "Danes" widget and "Ta teden" bento (US-002, US-004), from
 * the published Masses of src/lib/data/masses.ts.
 *
 * Modes of the widget:
 * - "today": a Mass is still ahead today (or under way: a Mass counts as
 *   "now" for MASS_MINUTES after it starts);
 * - "tomorrow": today's Masses are over and the next one is tomorrow;
 * - "none-today": no Mass ahead today, the next one later (`earlierToday`
 *   says whether today had any);
 * - "none-at-all": nothing in the next LOOKAHEAD days.
 * A cancelled Mass is listed with `cancelled: true` and never becomes the
 * headline. Everything is computed from a date and a "HH:MM" in Ljubljana,
 * so the pure functions below are tested without a clock.
 */
import "server-only";
import { today as clockToday, nowTime } from "@/lib/clock";
import { addDays, formatDayHeading, formatTime, formatWeekdayShort, weekdayOf, type IsoDate } from "@/lib/dates";
import { INTENTION_PREFIX, MASS_TYPE_LABEL, type Mass, type MassDay } from "@/lib/masses";
import type { PublicBulletin } from "./bulletins";
import { getMassDays } from "./masses";

/** How long after its start a Mass still counts as "now". */
export const MASS_MINUTES = 45;
/** Days searched for the next Mass. */
export const LOOKAHEAD = 14;
/** The widget's day timeline runs from 6.00 to 21.00. */
export const TIMELINE = { from: 6 * 60, to: 21 * 60 } as const;
/** The countdown chip shows only when the Mass is at most this many minutes away. */
export const COUNTDOWN_MAX = 12 * 60;

export type TodayMass = {
  key: string;
  date: IsoDate;
  /** "18:00" */
  time: string;
  /** "18.00" */
  label: string;
  /** "Sveta maša", "Nedeljska sveta maša" … */
  kind: string;
  /** "Marijina cerkev" */
  church: string;
  cancelled: boolean;
  cancelReason: string | null;
  /** Over (started more than MASS_MINUTES ago). */
  past: boolean;
  /** "† Branko Babnik", in schedule order; [] when none is entered yet. */
  intentions: string[];
};

export type TodayMode = "today" | "tomorrow" | "none-today" | "none-at-all";

export type TodayBlock = {
  mode: TodayMode;
  date: IsoDate;
  time: string;
  headline: string;
  /** Every Mass today, in order (the timeline; past ones struck through). */
  today: TodayMass[];
  /** The headline Mass. */
  next: TodayMass | null;
  /** The other Masses still ahead on next's day ("nato 10.00"). */
  following: TodayMass[];
  /** Minutes from now to `next` (0 while it is under way). */
  nextInMinutes: number | null;
  /** Labels of today's Masses that are over ("7.30"). */
  earlierToday: string[];
  /** The liturgical lines of next's day (or today's), from calendar_days. */
  day: { date: IsoDate; title: string | null; sundayName: string | null; gospel: string | null };
};

const minutes = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

const daysBetween = (from: IsoDate, to: IsoDate) => Math.round((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / 86_400_000);

function toTodayMass(m: Mass, date: IsoDate, now: { date: IsoDate; time: string }): TodayMass {
  const cancelled = m.status === "cancelled";
  return {
    key: m.key,
    date,
    time: m.time,
    label: formatTime(m.time),
    kind: MASS_TYPE_LABEL[m.type] ?? MASS_TYPE_LABEL.regular,
    church: m.church?.shortName || m.church?.name || "",
    cancelled,
    cancelReason: cancelled ? m.statusNote : null,
    past: date < now.date || (date === now.date && minutes(m.time) + MASS_MINUTES <= minutes(now.time)),
    intentions: cancelled ? [] : m.intentions.map((i) => [INTENTION_PREFIX[i.kind ?? ""], i.text].filter(Boolean).join(" ")),
  };
}

/** The widget for `date` at `time` (Ljubljana), from MassDays starting today. */
export function buildTodayBlock(days: MassDay[], date: IsoDate, time: string): TodayBlock {
  const now = { date, time };
  const all = days
    .filter((d) => d.date >= date)
    .flatMap((d) => d.masses.map((m) => toTodayMass(m, d.date, now)));
  const todays = all.filter((m) => m.date === date);
  const upcoming = all.filter((m) => !m.cancelled && !m.past);
  const next = upcoming[0] ?? null;
  const following = next ? upcoming.filter((m) => m.date === next.date && m !== next) : [];
  const earlierToday = todays.filter((m) => m.past && !m.cancelled).map((m) => m.label);
  const nextInMinutes = next ? Math.max(0, daysBetween(date, next.date) * 1440 + minutes(next.time) - minutes(time)) : null;
  const dayOf = days.find((d) => d.date === (next?.date ?? date));

  let mode: TodayMode;
  let headline: string;
  if (!next) {
    mode = "none-at-all";
    headline = "V naslednjih dneh ni vpisanih svetih maš";
  } else if (next.date === date) {
    mode = "today";
    headline = `Sveta maša danes ob ${next.label}`;
  } else if (earlierToday.length && next.date === addDays(date, 1)) {
    mode = "tomorrow";
    headline = `Jutri ob ${next.label}`;
  } else {
    mode = "none-today";
    headline = earlierToday.length ? "Današnje svete maše so že mimo" : "Danes ni svete maše";
  }

  return {
    mode,
    date,
    time,
    headline,
    today: todays,
    next,
    following,
    nextInMinutes,
    earlierToday,
    day: {
      date: dayOf?.date ?? date,
      title: dayOf?.liturgicalTitle ?? null,
      sundayName: dayOf?.sundayName ?? null,
      gospel: dayOf?.gospel ?? null,
    },
  };
}

/** "čez 3 h 20 min", "čez 45 min", "zdaj". */
export function formatCountdown(mins: number): string {
  if (mins <= 0) return "zdaj";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (!h) return `čez ${m} min`;
  return m ? `čez ${h} h ${m} min` : `čez ${h} h`;
}

/** The chip in the widget's corner: the countdown within 12 h, else "jutri" / "čez N dni"; null when nothing is ahead. */
export function countdownChip(block: Pick<TodayBlock, "next" | "nextInMinutes" | "date">): string | null {
  if (!block.next || block.nextInMinutes == null) return null;
  if (block.nextInMinutes <= COUNTDOWN_MAX) return formatCountdown(block.nextInMinutes);
  return formatDaysUntil(daysBetween(block.date, block.next.date));
}

/** Days from `from` to `to` (calendar days, Ljubljana dates). */
export function daysUntil(to: IsoDate, from: IsoDate): number {
  return daysBetween(from, to);
}

/** "danes", "jutri", "čez 4 dni". */
export function formatDaysUntil(n: number): string {
  if (n <= 0) return "danes";
  if (n === 1) return "jutri";
  return `čez ${n} dni`;
}

/** Position on the 6.00–21.00 timeline, in percent (clamped). */
export function timelinePercent(hhmm: string): number {
  const p = ((minutes(hhmm) - TIMELINE.from) / (TIMELINE.to - TIMELINE.from)) * 100;
  return Math.round(Math.min(100, Math.max(0, p)) * 10) / 10;
}

/** "Danes · sreda, 28. oktober" / "Jutri · četrtek, 29. oktober" / "Ponedeljek, 2. november". */
export function widgetDayLabel(target: IsoDate, base: IsoDate): string {
  const heading = formatDayHeading(target);
  if (target === base) return `Danes · ${heading.charAt(0).toLowerCase()}${heading.slice(1)}`;
  if (target === addDays(base, 1)) return `Jutri · ${heading.charAt(0).toLowerCase()}${heading.slice(1)}`;
  return heading;
}

export type WeekAheadDay = {
  date: IsoDate;
  /** "ČET", Sundays and feasts "NED · VSI SVETI". */
  label: string;
  /** "29" */
  day: string;
  sunday: boolean;
  masses: { key: string; label: string; church: string; cancelled: boolean }[];
};

/**
 * "Svete maše do nedelje": every day from tomorrow to the coming Sunday
 * (on a Sunday: to the next one) that has Masses.
 */
export function massesUntilSunday(days: MassDay[], date: IsoDate): WeekAheadDay[] {
  const dow = new Date(`${date}T12:00:00Z`).getUTCDay();
  const sunday = addDays(date, dow === 0 ? 7 : 7 - dow);
  return days
    .filter((d) => d.date > date && d.date <= sunday && d.masses.length)
    .map((d) => {
      const isSunday = weekdayOf(d.date) === "sunday";
      const wd = formatWeekdayShort(d.date).toUpperCase();
      const title = d.liturgicalTitle?.trim();
      return {
        date: d.date,
        label: title && (isSunday || d.masses.some((m) => m.type === "feast")) ? `${wd} · ${title.toUpperCase()}` : wd,
        day: String(Number(d.date.slice(8))),
        sunday: isSunday,
        masses: d.masses.map((m) => ({
          key: m.key,
          label: formatTime(m.time),
          church: (m.church?.shortName ?? "").replace(/ cerkev$/, ""),
          cancelled: m.status === "cancelled",
        })),
      };
    });
}

const MONTHS = ["januar", "februar", "marec", "april", "maj", "junij", "julij", "avgust", "september", "oktober", "november", "december"];
const MONTH_ADJECTIVE = ["januarska", "februarska", "marčna", "aprilska", "majska", "junijska", "julijska", "avgustovska", "septembrska", "oktobrska", "novembrska", "decembrska"];

/**
 * When the current bulletin doesn't cover today (the new month's is not out
 * yet): the month's heading and the note "Novembrska oznanila še niso
 * objavljena. Do takrat veljajo oktobrska." null when it covers today.
 */
export function missingBulletinNote(bulletin: Pick<PublicBulletin, "periodStart" | "periodEnd"> | null, date: IsoDate): { heading: string; note: string } | null {
  if (bulletin && bulletin.periodStart <= date && bulletin.periodEnd >= date) return null;
  const month = Number(date.slice(5, 7)) - 1;
  const heading = `${MONTHS[month].charAt(0).toUpperCase()}${MONTHS[month].slice(1)} ${date.slice(0, 4)}`;
  const now = `${MONTH_ADJECTIVE[month].charAt(0).toUpperCase()}${MONTH_ADJECTIVE[month].slice(1)} oznanila še niso objavljena.`;
  if (!bulletin) return { heading, note: now };
  const prev = Number(bulletin.periodStart.slice(5, 7)) - 1;
  return { heading, note: `${now} Do takrat veljajo ${MONTH_ADJECTIVE[prev]}.` };
}

/** The widget and the week ahead, for now (src/lib/clock). */
export async function getTodayBlock(): Promise<{ block: TodayBlock; week: WeekAheadDay[] }> {
  const date = clockToday();
  const days = await getMassDays(date, addDays(date, LOOKAHEAD));
  return { block: buildTodayBlock(days, date, nowTime()), week: massesUntilSunday(days, date) };
}
