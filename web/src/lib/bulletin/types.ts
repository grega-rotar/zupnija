/**
 * The draft Claude reads off a monthly bulletin (oznanila) and the priest
 * checks before publishing. Stored in `bulletins.draft` while the status is
 * draft/pending. Contract: tasks/contract-oznanila-monthly.md.
 *
 *   { readable: true, period, days: [{ date, title?, sundayName?, gospel?, tags, intentions }],
 *     notices, events, article?, prayerIntention? }
 *   { readable: false, reason }
 *
 * Intention times and churches are assigned by the server from the regular
 * schedule (assign.ts), never by the model. A `flag` marks something to
 * check; a bulletin publishes only when every flag has a resolution (one of
 * `options`, or a typed value), keyed by the intention's or event's id.
 */
import { z } from "zod";
import { formatWeekSpan } from "@/lib/dates";

export const FLAG_FIELDS = ["text", "time", "date", "church", "event"] as const;
export type FlagField = (typeof FLAG_FIELDS)[number];

export const INTENTION_KINDS = ["deceased", "thanksgiving", "other"] as const;
export type IntentionKind = (typeof INTENTION_KINDS)[number];

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date must be YYYY-MM-DD");
/** Accepts "7:00", "07.00", "18:30:00"; stores "07:00". */
const hhmm = z
  .string()
  .regex(/^\d{1,2}[:.]\d{2}(:\d{2})?$/, "time must be HH:MM")
  .transform((t) => {
    const [h, m] = t.split(/[:.]/);
    return `${h.padStart(2, "0")}:${m}`;
  });
/** Models sometimes send null for a missing optional field. */
const opt = <T extends z.ZodType>(s: T) => z.preprocess((v) => (v == null || v === "" ? undefined : v), s.optional());
const titled = z.object({ title: z.string().trim(), text: z.string().trim() });

export const flagSchema = z.object({
  field: z.enum(FLAG_FIELDS),
  /** Slovenian, e.g. "Priimek je slabo čitljiv. Piše Novak ali Nosak?" */
  question: z.string().min(1),
  options: z.array(z.string().min(1)).min(1),
});

export const intentionSchema = z.object({
  id: z.string().min(1),
  /** Without the +/++ markers. */
  text: z.string().trim().min(1).max(200),
  kind: z.enum(INTENTION_KINDS),
  /** Assigned by the server from the schedule. */
  time: hhmm,
  churchSlug: z.string().min(1),
  /** The row as printed, for the side-by-side preview. */
  sourceLine: opt(z.string()),
  flag: opt(flagSchema),
});

export const daySchema = z.object({
  date: isoDate,
  /** The liturgical day or saint ("Simon in Juda Tadej, apostola"). */
  title: opt(z.string().trim()),
  /** Sundays: "28. navadna nedelja". */
  sundayName: opt(z.string().trim()),
  /** Sundays: "»Kje pa je onih devet?«". */
  gospel: opt(z.string().trim()),
  tags: z.preprocess((v) => v ?? [], z.array(z.string().trim().min(1))),
  intentions: z.preprocess((v) => v ?? [], z.array(intentionSchema)),
});

export const eventSchema = z.object({
  id: z.string().min(1),
  title: z.string().trim().min(1).max(200),
  date: isoDate,
  time: opt(hhmm),
  place: opt(z.string().trim()),
  description: opt(z.string().trim()),
  /** The priest can untick an event; default true. */
  include: z.preprocess((v) => v ?? true, z.boolean()),
  flag: opt(flagSchema),
});

export const noticeSchema = z.object({ id: z.string().min(1), text: z.string().trim().min(1) });

export const periodSchema = z.object({
  start: isoDate,
  end: isoDate,
  /** "Oktober 2026". */
  title: z.string().trim().min(1),
  /** "Leto XLII, številka 10". */
  issue: opt(z.string().trim()),
});

export const readableDraftSchema = z.object({
  readable: z.literal(true),
  period: periodSchema,
  /** Every day of the period that has anything, in date order. */
  days: z.array(daySchema),
  notices: z.array(noticeSchema),
  events: z.preprocess((v) => v ?? [], z.array(eventSchema)),
  article: opt(titled),
  prayerIntention: opt(titled),
});

export const unreadableDraftSchema = z.object({
  readable: z.literal(false),
  reason: z.string(),
});

export const bulletinDraftSchema = z.discriminatedUnion("readable", [readableDraftSchema, unreadableDraftSchema]);

export type BulletinFlag = z.output<typeof flagSchema>;
export type DraftIntention = z.output<typeof intentionSchema>;
export type DraftDay = z.output<typeof daySchema>;
export type DraftEvent = z.output<typeof eventSchema>;
export type DraftNotice = z.output<typeof noticeSchema>;
export type BulletinPeriod = z.output<typeof periodSchema>;
export type ReadableDraft = z.output<typeof readableDraftSchema>;
export type BulletinDraft = z.output<typeof bulletinDraftSchema>;

export type BulletinStatus = "reading" | "draft" | "unreadable" | "ai_busy" | "pending" | "published";

/** A generated Mass of the period as the extractor and the schedule check see it. */
export type PeriodMass = { id?: number; date: string; time: string; churchSlug: string };
/** @deprecated weekly name; use PeriodMass. */
export type WeekMass = PeriodMass;
export type ChurchInfo = { slug: string; name: string };

/** An intention with its day's date, as the flat lists below return it. */
export type DatedIntention = DraftIntention & { date: string };

/** Every intention of the draft in date and table order, with its date. */
export const allIntentions = (d: Pick<ReadableDraft, "days">): DatedIntention[] =>
  d.days.flatMap((day) => day.intentions.map((i) => ({ ...i, date: day.date })));

/** Intentions that still need a decision. */
export const flaggedIntentions = (d: Pick<ReadableDraft, "days">): DatedIntention[] => allIntentions(d).filter((i) => i.flag);

/** Events that still need a decision (only included ones count). */
export const flaggedEvents = (d: Pick<ReadableDraft, "events">): DraftEvent[] => d.events.filter((e) => e.include && e.flag);

/** Number of open flags (intentions + included events). */
export const flagCount = (d: Pick<ReadableDraft, "days" | "events">): number => flaggedIntentions(d).length + flaggedEvents(d).length;

/** Sunday that starts the week of `iso` (weeks run Sunday–Saturday). */
export function sundayOf(iso: string): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - d.getUTCDay());
  return d.toISOString().slice(0, 10);
}

/**
 * The days grouped into Sunday-start weeks, in order. A month's first and
 * last week are partial: `start` is still the Sunday, `days` only what the
 * draft has.
 */
export function weeksOf<D extends { date: string }>(days: D[]): { start: string; days: D[] }[] {
  const out: { start: string; days: D[] }[] = [];
  for (const day of [...days].sort((a, b) => a.date.localeCompare(b.date))) {
    const start = sundayOf(day.date);
    const last = out[out.length - 1];
    if (last?.start === start) last.days.push(day);
    else out.push({ start, days: [day] });
  }
  return out;
}

const MONTHS = ["januar", "februar", "marec", "april", "maj", "junij", "julij", "avgust", "september", "oktober", "november", "december"];

/** "2026-10-01" → "Oktober 2026". */
export function monthTitle(iso: string): string {
  const [y, m] = iso.split("-").map(Number);
  const name = MONTHS[m - 1];
  return `${name[0].toUpperCase()}${name.slice(1)} ${y}`;
}

/** First and last day of the month of `iso`. */
export function monthPeriod(iso: string): { start: string; end: string } {
  const [y, m] = iso.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const mm = String(m).padStart(2, "0");
  return { start: `${y}-${mm}-01`, end: `${y}-${mm}-${String(last).padStart(2, "0")}` };
}

/** The period is exactly one calendar month. */
export const isWholeMonth = (start: string, end: string) => start.endsWith("-01") && monthPeriod(start).end === end;

/** Default title of a period: "Oktober 2026" for a whole month, else "1.–7. november 2026". */
export function periodTitle(start: string, end: string): string {
  return isWholeMonth(start, end) ? monthTitle(start) : formatWeekSpan(start, end, true);
}

/** The period in running text: "oktober 2026", "25.–31. oktober 2026". */
export function periodLabel(start: string, end: string): string {
  return isWholeMonth(start, end) ? monthTitle(start).toLowerCase() : formatWeekSpan(start, end, true);
}

/** "2026-10-15" → "2026-11-01". */
export function nextMonthStart(iso: string): string {
  const [y, m] = iso.split("-").map(Number);
  return m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`;
}

/** The period the parish still has to upload, and whether Domov should say so. */
export type MissingPeriod = { start: string; end: string; title: string; /** Domov shows "Oznanila za … še niso naložena". */ due: boolean };
/** @deprecated name from the first monthly version; same as MissingPeriod. */
export type MissingMonth = MissingPeriod;

const addDaysIso = (iso: string, n: number) => {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const daysBetween = (a: string, b: string) => Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 86_400_000);

/**
 * The next bulletin to upload (contract "Missing-bulletin logic", any period
 * length). Only published and pending bulletins count.
 *
 *   start: when today is covered, the first uncovered day after it; else the
 *          day after the last covered day before today, but not before the
 *          1st of the current month.
 *   end:   the end of that month when start is a 1st; else as long as the
 *          bulletin before it when that was a week or so (≤ 10 days); else
 *          the end of start's month.
 *   due:   always when start is today or earlier; for a month, from the
 *          20th of the month before; otherwise 7 days ahead.
 *
 * The document's own period wins when it is read (extract.ts). Pure.
 */
export function missingPeriod(todayIso: string, bulletins: { periodStart: string; periodEnd: string; status: string }[]): MissingPeriod {
  const done = bulletins.filter((b) => b.status === "published" || b.status === "pending");
  const covering = (d: string) => done.find((b) => b.periodStart <= d && b.periodEnd >= d);
  let start: string;
  if (covering(todayIso)) {
    start = todayIso;
    for (let n = 0; n < 800 && covering(start); n++) start = addDaysIso(covering(start)!.periodEnd, 1);
  } else {
    const before = done.map((b) => b.periodEnd).filter((e) => e < todayIso).sort().pop();
    const first = monthPeriod(todayIso).start;
    start = before && addDaysIso(before, 1) > first ? addDaysIso(before, 1) : first;
  }
  let end: string;
  if (start.endsWith("-01")) end = monthPeriod(start).end;
  else {
    const prev = done.find((b) => b.periodEnd === addDaysIso(start, -1));
    const len = prev ? daysBetween(prev.periodStart, prev.periodEnd) + 1 : 0;
    end = len > 0 && len <= 10 ? addDaysIso(start, len - 1) : monthPeriod(start).end;
  }
  const lead = start.endsWith("-01") ? daysBetween(`${addDaysIso(start, -1).slice(0, 8)}20`, start) : 7;
  const due = start <= todayIso || daysBetween(todayIso, start) <= lead;
  return { start, end, title: periodTitle(start, end), due };
}

/** @deprecated name from the first monthly version; same as missingPeriod. */
export const missingMonth = missingPeriod;

/** An empty draft for a period ("Vpiši ročno"). */
export function emptyDraft(period: { start: string; end: string; title?: string }): ReadableDraft {
  return { readable: true, period: { start: period.start, end: period.end, title: period.title ?? periodTitle(period.start, period.end) }, days: [], notices: [], events: [] };
}
