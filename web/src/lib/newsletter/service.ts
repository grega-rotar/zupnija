/**
 * Bulletins by e-mail (PRD US-005, ZUP-19): double opt-in subscribe, confirm
 * by a single-use token valid 48 hours, unsubscribe by the subscriber's
 * permanent token, the cleanup of unconfirmed addresses, queueing a published bulletin for
 * every active subscriber, and the numbers the editor's "Naročniki" tab shows.
 *
 * The confirmation goes out at once (sendMail). The bulletin goes only into
 * `outbox`; /api/cron/outbox sends it, throttled (lib/mail/outbox.ts).
 */
import { randomBytes } from "node:crypto";
import { and, count, desc, eq, gte, isNotNull, isNull, lt, ne, or, sql } from "drizzle-orm";
import { db, schema, type Tx } from "@/db";
import { now } from "@/lib/clock";
import { sendMail } from "@/lib/mail";
import { routes } from "@/lib/routes";
import { absoluteUrl } from "@/lib/seo";
import { bulletinMail, confirmMail, type BulletinMailInput } from "./content";

const s = schema.newsletterSubscribers;
const o = schema.outbox;

export const NEWSLETTER_KIND = "newsletter";

export const confirmUrl = (token: string) => absoluteUrl(`/obvestila/potrdi?token=${encodeURIComponent(token)}`);
export const unsubscribeUrl = (token: string) => absoluteUrl(`/obvestila/odjava?token=${encodeURIComponent(token)}`);
/** The answer to every accepted signup (ZUP-19), whether or not the address is already subscribed or was just sent a mail. */
export const THANK_YOU = "Na vaš elektronski naslov smo poslali sporočilo s povezavo za potrditev prijave.";

/** A confirmation link is valid this long; an unconfirmed address is deleted after it (deleteUnconfirmed). */
export const CONFIRM_VALID_MS = 48 * 60 * 60 * 1000;
/** At most one confirmation mail per address in this time. */
export const RESEND_AFTER_MS = 10 * 60 * 1000;

const newToken = () => randomBytes(24).toString("base64url");
const ago = (ms: number) => new Date(now().getTime() - ms);

/**
 * Subscribe `email` (already validated) by double opt-in (ZUP-19). A new or
 * unsubscribed address becomes pending and gets a confirmation mail with a
 * fresh single-use token; a pending one gets a new mail (and token) only if
 * the last one is older than 10 minutes; an active one gets nothing. The
 * caller says the same in every case, so nobody learns who is subscribed.
 */
export async function subscribe(email: string): Promise<void> {
  const address = email.trim().toLowerCase();
  const confirmToken = newToken();
  const at = now();
  const [row] = await db.select().from(s).where(eq(s.email, address));
  if (row?.status === "active") return;
  if (row) {
    // Conditional, so two submits at once send one mail.
    const [updated] = await db
      .update(s)
      .set({ status: "pending", confirmToken, confirmSentAt: at, consentAt: at, unsubscribedAt: null })
      .where(and(eq(s.id, row.id), ne(s.status, "active"), or(isNull(s.confirmSentAt), lt(s.confirmSentAt, ago(RESEND_AFTER_MS)))))
      .returning({ id: s.id });
    if (!updated) return;
  } else {
    // A double submit races here; the unique e-mail keeps one row.
    const [created] = await db
      .insert(s)
      .values({ email: address, token: newToken(), confirmToken, confirmSentAt: at, consentAt: at })
      .onConflictDoNothing()
      .returning();
    if (!created) return;
  }
  const mail = confirmMail(confirmUrl(confirmToken));
  await sendMail({ to: address, ...mail });
}

export type ConfirmResult = "confirmed" | "invalid";

/**
 * The link in the confirmation mail: pending → active, once. The token is
 * cleared on use, and a token older than 48 hours, a newer mail's
 * replacement or an unsubscribed address's no longer works.
 */
export async function confirm(token: string | null | undefined): Promise<ConfirmResult> {
  if (!token) return "invalid";
  const [row] = await db
    .update(s)
    .set({ status: "active", confirmedAt: now(), confirmToken: null })
    .where(and(eq(s.confirmToken, token), eq(s.status, "pending"), gte(s.confirmSentAt, ago(CONFIRM_VALID_MS))))
    .returning({ id: s.id });
  return row ? "confirmed" : "invalid";
}

/**
 * Deletes addresses still unconfirmed 48 hours after their last confirmation
 * mail (ZUP-19). /api/cron/outbox runs it every 5 minutes. Returns how many.
 */
export async function deleteUnconfirmed(): Promise<number> {
  const gone = await db
    .delete(s)
    .where(and(eq(s.status, "pending"), or(isNull(s.confirmSentAt), lt(s.confirmSentAt, ago(CONFIRM_VALID_MS)))))
    .returning({ id: s.id });
  return gone.length;
}

/** The link in every mail and the one-click POST. Queued mails to the address are dropped. */
export async function unsubscribe(token: string | null | undefined): Promise<"done" | "invalid"> {
  if (!token) return "invalid";
  const [row] = await db.select().from(s).where(eq(s.token, token));
  if (!row) return "invalid";
  if (row.status !== "unsubscribed") {
    await db.update(s).set({ status: "unsubscribed", unsubscribedAt: now(), confirmToken: null }).where(eq(s.id, row.id));
  }
  await db
    .update(o)
    .set({ status: "failed", error: "Odjavljen." })
    .where(and(eq(o.to, row.email), eq(o.kind, NEWSLETTER_KIND), eq(o.status, "queued")));
  return "done";
}

/**
 * Called from bulletin.publish (inside its transaction): queue the bulletin
 * for every active subscriber, once. `mailed_at` is written directly, not
 * through the Tracker, and before the publish records the bulletin row, so
 * undoing the publish keeps it set and a re-publish never mails again.
 * Returns how many mails were queued.
 */
export async function queueBulletin(tx: Tx, bulletinId: number, content: Omit<BulletinMailInput, "pageUrl" | "pdfUrl">): Promise<number> {
  const b = schema.bulletins;
  const [row] = await tx
    .select({ mailedAt: b.mailedAt, periodStart: b.periodStart, mime: schema.uploads.mime })
    .from(b)
    .leftJoin(schema.uploads, eq(schema.uploads.id, b.uploadId))
    .where(eq(b.id, bulletinId));
  if (!row || row.mailedAt) return 0;
  await tx.update(b).set({ mailedAt: now() }).where(eq(b.id, bulletinId));

  const subscribers = await tx.select({ email: s.email, token: s.token }).from(s).where(eq(s.status, "active")).orderBy(s.id);
  if (!subscribers.length) return 0;
  const input: BulletinMailInput = {
    ...content,
    pageUrl: absoluteUrl(routes.announcements),
    pdfUrl: row.mime === "application/pdf" ? absoluteUrl(routes.bulletinPdf(row.periodStart)) : null,
  };
  const at = now();
  await tx.insert(o).values(
    subscribers.map((sub) => {
      const link = unsubscribeUrl(sub.token);
      const mail = bulletinMail(input, link);
      return {
        kind: NEWSLETTER_KIND,
        ref: `bulletin:${bulletinId}`,
        to: sub.email,
        ...mail,
        headers: { "List-Unsubscribe": `<${link}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
        sendAfter: at,
      };
    }),
  );
  return subscribers.length;
}

export type NewsletterStats = {
  active: number;
  pending: number;
  unsubscribed: number;
  /** The newest bulletin that was mailed, and how far its sending got. */
  last: { title: string; mailedAt: Date; sent: number; total: number; queued: number; failed: number } | null;
  subscribers: { email: string; status: "pending" | "active" | "unsubscribed"; since: Date }[];
};

export async function newsletterStats(): Promise<NewsletterStats> {
  const counts = await db.select({ status: s.status, n: count() }).from(s).groupBy(s.status);
  const n = (st: string) => counts.find((c) => c.status === st)?.n ?? 0;
  const b = schema.bulletins;
  const [lastB] = await db.select({ id: b.id, title: b.title, mailedAt: b.mailedAt }).from(b).where(isNotNull(b.mailedAt)).orderBy(desc(b.mailedAt)).limit(1);
  let last: NewsletterStats["last"] = null;
  if (lastB) {
    const [r] = await db
      .select({
        total: count(),
        sent: sql<number>`count(*) filter (where ${o.status} = 'sent')`.mapWith(Number),
        queued: sql<number>`count(*) filter (where ${o.status} = 'queued')`.mapWith(Number),
        failed: sql<number>`count(*) filter (where ${o.status} = 'failed')`.mapWith(Number),
      })
      .from(o)
      .where(eq(o.ref, `bulletin:${lastB.id}`));
    last = { title: lastB.title, mailedAt: lastB.mailedAt!, ...r };
  }
  const rows = await db.select().from(s).orderBy(desc(s.createdAt), desc(s.id));
  return {
    active: n("active"),
    pending: n("pending"),
    unsubscribed: n("unsubscribed"),
    last,
    subscribers: rows.map((r) => ({ email: r.email, status: r.status, since: r.confirmedAt ?? r.consentAt })),
  };
}
