/**
 * The throttled sender for bulk mail (the newsletter). Rows wait in `outbox`;
 * /api/cron/outbox calls sendDue every 5 minutes (docs/TECHNICAL.md).
 *
 * - At most MAIL_DAILY_LIMIT (default 90) outbox mails per Ljubljana day: the
 *   provider's free tier allows 100, which leaves room for the one-off mails
 *   (confirmations, form notifications, sign-in links) that go out directly.
 *   What is due beyond the limit waits until 06:00 the next day.
 * - A provider error retries with backoff (5, 10, 20, 40 min); the 5th failure
 *   marks the row failed.
 * - A newsletter mail is sent only while its bulletin is still published (an
 *   undone publish holds it) and its subscriber still active.
 */
import "server-only";
import { and, asc, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { now as clockNow } from "@/lib/clock";
import { addDays, today } from "@/lib/dates";
import { sendMail, type OutgoingMail, type SendResult } from "@/lib/mail";

const o = schema.outbox;

export const DEFAULT_DAILY_LIMIT = 90;
export const MAX_ATTEMPTS = 5;
/** How long a claimed row stays invisible to an overlapping run. */
const LEASE_MS = 10 * 60_000;

export function dailyLimit(): number {
  const n = Number.parseInt(process.env.MAIL_DAILY_LIMIT ?? "", 10);
  return Number.isFinite(n) && n >= 0 ? n : DEFAULT_DAILY_LIMIT;
}

const offsetFmt = new Intl.DateTimeFormat("en-US", { timeZone: "Europe/Ljubljana", timeZoneName: "longOffset" });

/** The instant of `time` ("06:00") on `date` in Ljubljana. */
export function ljubljanaInstant(date: string, time: string): Date {
  const guess = new Date(`${date}T${time}:00Z`);
  const name = offsetFmt.formatToParts(guess).find((p) => p.type === "timeZoneName")?.value ?? "GMT+01:00";
  const m = name.match(/GMT([+-])(\d{2}):(\d{2})/);
  const minutes = m ? (m[1] === "-" ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3])) : 60;
  return new Date(guess.getTime() - minutes * 60_000);
}

export type SendDueResult = { sent: number; retry: number; failed: number; held: number; deferred: number };
type Sender = (mail: OutgoingMail) => Promise<SendResult>;

const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function sendDue(opts: { limit?: number; send?: Sender; now?: Date } = {}): Promise<SendDueResult> {
  const limit = opts.limit ?? dailyLimit();
  const send = opts.send ?? sendMail;
  const at = opts.now ?? clockNow();
  const day = today(at);
  const out: SendDueResult = { sent: 0, retry: 0, failed: 0, held: 0, deferred: 0 };

  const [{ n: sentToday }] = await db
    .select({ n: sql<number>`count(*)`.mapWith(Number) })
    .from(o)
    .where(and(eq(o.status, "sent"), gte(o.sentAt, ljubljanaInstant(day, "00:00"))));
  const room = Math.max(0, limit - sentToday);

  // Claim what fits today (skip rows an overlapping run holds), pushing send_after out as a lease.
  const claimed = room
    ? await db.execute<{ id: number }>(sql`
        update ${o} set send_after = ${new Date(at.getTime() + LEASE_MS).toISOString()}::timestamptz
        where id in (
          select id from ${o} where status = 'queued' and send_after <= ${at.toISOString()}::timestamptz
          order by send_after, id limit ${room} for update skip locked
        ) returning id`)
    : [];
  const ids = [...claimed].map((r) => Number(r.id));
  const rows = ids.length ? await db.select().from(o).where(inArray(o.id, ids)).orderBy(asc(o.id)) : [];

  // Is the bulletin still published, the subscriber still active?
  const bulletinIds = [...new Set(rows.map((r) => r.ref?.match(/^bulletin:(\d+)$/)?.[1]).filter(Boolean).map(Number))];
  const live = new Set(
    bulletinIds.length
      ? (await db.select({ id: schema.bulletins.id }).from(schema.bulletins).where(and(inArray(schema.bulletins.id, bulletinIds), eq(schema.bulletins.status, "published")))).map((b) => `bulletin:${b.id}`)
      : [],
  );
  const s = schema.newsletterSubscribers;
  const emails = [...new Set(rows.filter((r) => r.kind === "newsletter").map((r) => r.to))];
  const active = new Set(
    emails.length ? (await db.select({ email: s.email }).from(s).where(and(inArray(s.email, emails), eq(s.status, "active")))).map((x) => x.email) : [],
  );

  const throttle = !!process.env.RESEND_API_KEY; // the provider takes about 2 requests a second
  for (const row of rows) {
    if (row.ref?.startsWith("bulletin:") && !live.has(row.ref)) {
      await db.update(o).set({ sendAfter: new Date(at.getTime() + 60 * 60_000) }).where(eq(o.id, row.id));
      out.held++;
      continue;
    }
    if (row.kind === "newsletter" && !active.has(row.to)) {
      await db.update(o).set({ status: "failed", error: "Naročnik ni več prijavljen." }).where(eq(o.id, row.id));
      out.failed++;
      continue;
    }
    if (throttle && out.sent + out.retry) await pause(600);
    const r = await send({ to: row.to, subject: row.subject, text: row.text, html: row.html ?? undefined, headers: row.headers as Record<string, string> });
    if (r.ok) {
      await db.update(o).set({ status: "sent", sentAt: clockNow(), attempts: row.attempts + 1, error: null }).where(eq(o.id, row.id));
      out.sent++;
    } else {
      const attempts = row.attempts + 1;
      const done = attempts >= MAX_ATTEMPTS;
      await db
        .update(o)
        .set({ status: done ? "failed" : "queued", attempts, error: r.error, sendAfter: new Date(at.getTime() + 5 * 60_000 * 2 ** (attempts - 1)) })
        .where(eq(o.id, row.id));
      if (done) out.failed++;
      else out.retry++;
    }
  }

  // Due but over today's limit: wait for tomorrow 06:00.
  const tomorrow = ljubljanaInstant(addDays(day, 1), "06:00");
  const deferred = await db
    .update(o)
    .set({ sendAfter: tomorrow })
    .where(and(eq(o.status, "queued"), lte(o.sendAfter, at)))
    .returning({ id: o.id });
  out.deferred = deferred.length;
  return out;
}
