/** Labels for Masses in the editor, as in the prototype: "sreda, 28. oktober", "18.30", "†". */
import { formatDayHeading, formatTime, WEEKDAY_LABEL, weekdayOf } from "@/lib/dates";

export type IntentionKind = "deceased" | "thanksgiving" | "other";

/** "sreda, 28. oktober" */
export function dayLabel(date: string): string {
  const s = formatDayHeading(date);
  return s.charAt(0).toLowerCase() + s.slice(1);
}

/** "sreda" */
export function weekdayLabel(date: string): string {
  return WEEKDAY_LABEL[weekdayOf(date)];
}

/** "18:30:00" (Postgres time) → "18:30". */
export const hhmm = (t: string) => t.slice(0, 5);

/** "18:30" → "18.30" */
export const timeLabel = (t: string) => formatTime(hhmm(t));

/** "†" for the deceased, "·" otherwise. */
export const kindPrefix = (kind: string) => (kind === "deceased" ? "†" : "·");

/** Feast days shown above a day in the week view. */
export const FEASTS: Record<string, string> = {
  "2026-11-01": "Vsi sveti",
  "2026-11-02": "Spomin vseh vernih rajnih",
};
