/**
 * The anonymous prayer request on a group's page (ZUP-25, molitvena skupina).
 *
 * The visitor writes one text and ticks the consent; the request is mailed
 * to the address the group names in the editor (`prayerEmail`, else
 * PRAYER_EMAIL_DEFAULT) and nothing else happens: no table, no log line with
 * the text, no name, IP or browser in the mail. The IP is used only by the
 * shared rate limit (rate_limit_hits keeps "molitev:<ip>" for its 10-minute
 * window), and the honeypot is the shared one (src/lib/forms/public.ts).
 */
import "server-only";
import { z } from "zod";
import type { Db } from "@/db";
import { now } from "@/lib/clock";
import { contentStore, readPrayerRecipient, type Store } from "@/lib/content/read";
import { PRAYER_EMAIL_DEFAULT } from "@/lib/content/fields";
import { formatDate, formatTime } from "@/lib/dates";
import { fields, submitPublicForm, type FormResult } from "@/lib/forms/public";
import { sendMail } from "@/lib/mail";

export const PRAYER_MAX = 1000;
export const PRAYER_THANKS = "Hvala. Vašo prošnjo bomo vključili v molitev.";
export const PRAYER_SUBJECT = "Prošnja za molitev";

export const prayerRequestSchema = z.object({
  group: z.preprocess((v) => (typeof v === "string" ? v.trim() : ""), z.string().min(1)),
  text: fields.text("Vpišite svojo prošnjo.", PRAYER_MAX, `Prošnja je lahko dolga največ ${PRAYER_MAX} znakov.`),
  consent: fields.checkbox().refine((v) => v, "Za oddajo potrdite soglasje."),
});

const ymd = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Ljubljana", year: "numeric", month: "2-digit", day: "2-digit" });
const hm = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Ljubljana", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });

/** The whole mail: the date it was sent and the text, nothing about the sender. */
export function prayerMailText(text: string, at: Date): string {
  return `Oddano: ${formatDate(ymd.format(at))} ob ${formatTime(hm.format(at))}\n\n${text}`;
}

export async function submitPrayerRequest(
  data: FormData | Record<string, unknown>,
  opts: { ip?: string; dbx?: Db; store?: Store } = {},
): Promise<FormResult> {
  return submitPublicForm({
    form: "molitev",
    schema: prayerRequestSchema,
    data,
    thanks: PRAYER_THANKS,
    ip: opts.ip,
    dbx: opts.dbx,
    handle: async ({ group, text }) => {
      const target = readPrayerRecipient(opts.store ?? (await contentStore()), group);
      if (!target) return { ok: false, message: "Prošnje trenutno ni mogoče oddati.", fieldErrors: {} };
      const sent = await sendMail({ to: target.email ?? PRAYER_EMAIL_DEFAULT, subject: PRAYER_SUBJECT, text: prayerMailText(text, now()) });
      if (!sent.ok) return { ok: false, message: "Prošnje ni bilo mogoče poslati. Poskusite znova pozneje.", fieldErrors: {} };
      return { ok: true, message: PRAYER_THANKS };
    },
  });
}
