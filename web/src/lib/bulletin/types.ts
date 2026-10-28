/**
 * The draft Claude reads off a bulletin (oznanila) and the priest checks before
 * publishing. Stored in `bulletins.draft` while the status is draft/pending.
 *
 *   { readable: true, weekStart, items: [{ id, date, time, churchSlug, kind, text, sourceLine?, flag? }], notices }
 *   { readable: false, reason }
 *
 * A `flag` marks something to check: the model was unsure, or the schedule
 * check (flags.ts) found a mismatch. A bulletin publishes only when every flag
 * has a resolution (one of `options`, or a typed value).
 */
import { z } from "zod";

export const FLAG_FIELDS = ["text", "time", "date", "church"] as const;
export type FlagField = (typeof FLAG_FIELDS)[number];

export const INTENTION_KINDS = ["deceased", "thanksgiving", "other"] as const;

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
const opt = <T extends z.ZodType>(s: T) => z.preprocess((v) => v ?? undefined, s.optional());

export const flagSchema = z.object({
  field: z.enum(FLAG_FIELDS),
  /** Slovenian, e.g. "Priimek je slabo čitljiv. Piše Novak ali Nosak?" */
  question: z.string().min(1),
  options: z.array(z.string().min(1)).min(1),
});

export const itemSchema = z.object({
  id: z.string().min(1),
  date: isoDate,
  time: hhmm,
  churchSlug: z.string().min(1),
  kind: z.enum(INTENTION_KINDS),
  text: z.string().trim().min(1).max(200),
  /** The line as written on the sheet, for the side-by-side preview. */
  sourceLine: opt(z.string()),
  flag: opt(flagSchema),
});

export const readableDraftSchema = z.object({
  readable: z.literal(true),
  weekStart: isoDate,
  items: z.array(itemSchema),
  notices: z.array(z.string().trim().min(1)),
});

export const unreadableDraftSchema = z.object({
  readable: z.literal(false),
  reason: z.string(),
});

export const bulletinDraftSchema = z.discriminatedUnion("readable", [readableDraftSchema, unreadableDraftSchema]);

export type BulletinFlag = z.output<typeof flagSchema>;
export type BulletinItem = z.output<typeof itemSchema>;
export type ReadableDraft = z.output<typeof readableDraftSchema>;
export type BulletinDraft = z.output<typeof bulletinDraftSchema>;

export type BulletinStatus = "reading" | "draft" | "unreadable" | "ai_busy" | "pending" | "published";

/** A Mass of the target week as the extractor and the schedule check see it. */
export type WeekMass = { id?: number; date: string; time: string; churchSlug: string };
export type ChurchInfo = { slug: string; name: string };

/** Items that still need a decision. */
export const flaggedItems = (d: ReadableDraft) => d.items.filter((i) => i.flag);
