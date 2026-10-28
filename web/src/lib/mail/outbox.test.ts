import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { db, schema } from "@/db";
import { clearDevOutbox, devOutbox, type OutgoingMail } from "@/lib/mail";
import { resetDb } from "@/test/db";
import { DEFAULT_DAILY_LIMIT, dailyLimit, ljubljanaInstant, sendDue } from "./outbox";

const o = schema.outbox;
const s = schema.newsletterSubscribers;
const NOW = new Date("2026-10-27T10:00:00+01:00");

async function seed(n: number, opts: { bulletinStatus?: "published" | "draft" } = {}) {
  const [b] = await db
    .insert(schema.bulletins)
    .values({ periodStart: "2026-10-01", periodEnd: "2026-10-31", title: "Oktober 2026", status: opts.bulletinStatus ?? "published" })
    .returning();
  const emails = Array.from({ length: n }, (_, i) => `n${i + 1}@primer.si`);
  if (n) {
    await db.insert(s).values(emails.map((email) => ({ email, token: `t-${email}`, status: "active" as const, consentAt: NOW, confirmedAt: NOW })));
    await db.insert(o).values(
      emails.map((to) => ({
        kind: "newsletter",
        ref: `bulletin:${b.id}`,
        to,
        subject: "Oznanila za oktober 2026",
        text: "…",
        html: "<p>…</p>",
        headers: { "List-Unsubscribe": `<http://localhost:3000/obvestila/odjava?token=t-${to}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
        sendAfter: new Date(NOW.getTime() - 60_000),
      })),
    );
  }
  return b.id;
}

const rows = () => db.select().from(o).orderBy(o.id);

beforeEach(async () => {
  await resetDb();
  clearDevOutbox();
});
afterEach(() => {
  delete process.env.MAIL_DAILY_LIMIT;
});

describe("ljubljanaInstant", () => {
  it("06:00 in winter and summer time", () => {
    expect(ljubljanaInstant("2026-10-28", "06:00").toISOString()).toBe("2026-10-28T05:00:00.000Z");
    expect(ljubljanaInstant("2026-07-01", "06:00").toISOString()).toBe("2026-07-01T04:00:00.000Z");
    expect(ljubljanaInstant("2026-10-25", "00:00").toISOString()).toBe("2026-10-24T22:00:00.000Z");
  });
});

describe("sendDue [db]", () => {
  it("MAIL_DAILY_LIMIT defaults to 90", () => {
    expect(dailyLimit()).toBe(DEFAULT_DAILY_LIMIT);
    expect(DEFAULT_DAILY_LIMIT).toBe(90);
    process.env.MAIL_DAILY_LIMIT = "10";
    expect(dailyLimit()).toBe(10);
    process.env.MAIL_DAILY_LIMIT = "nič";
    expect(dailyLimit()).toBe(90);
  });

  it("120 active subscribers: 90 sent today, 30 stay queued until tomorrow 06:00", async () => {
    await seed(120);
    const r = await sendDue({ now: NOW });
    expect(r).toMatchObject({ sent: 90, deferred: 30, failed: 0, retry: 0 });
    const all = await rows();
    expect(all.filter((x) => x.status === "sent")).toHaveLength(90);
    const left = all.filter((x) => x.status === "queued");
    expect(left).toHaveLength(30);
    expect(left.every((x) => x.sendAfter.toISOString() === "2026-10-28T05:00:00.000Z")).toBe(true);
    expect(devOutbox()).toHaveLength(50); // the dev outbox keeps only the newest 50

    // Later the same day: the limit is used up, nothing goes out.
    expect(await sendDue({ now: new Date("2026-10-27T18:00:00+01:00") })).toMatchObject({ sent: 0 });
    // Tomorrow at 06:05 the rest goes.
    expect(await sendDue({ now: new Date("2026-10-28T06:05:00+01:00") })).toMatchObject({ sent: 30, deferred: 0 });
    expect((await rows()).every((x) => x.status === "sent")).toBe(true);
  });

  it("sends the List-Unsubscribe headers with each mail", async () => {
    await seed(1);
    const seen: OutgoingMail[] = [];
    await sendDue({ now: NOW, send: async (m) => (seen.push(m), { ok: true, delivered: true }) });
    expect(seen).toHaveLength(1);
    expect(seen[0]).toMatchObject({ to: "n1@primer.si", subject: "Oznanila za oktober 2026", html: "<p>…</p>" });
    expect(seen[0].headers).toEqual({
      "List-Unsubscribe": "<http://localhost:3000/obvestila/odjava?token=t-n1@primer.si>",
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    });
    expect((await rows())[0]).toMatchObject({ status: "sent", attempts: 1 });
  });

  it("a provider error retries with backoff; the 5th failure marks the row failed", async () => {
    await seed(1);
    const fail = async () => ({ ok: false as const, error: "Ponudnik pošte je vrnil napako (429)." });
    let at = NOW;
    for (let attempt = 1; attempt <= 4; attempt++) {
      expect(await sendDue({ now: at, send: fail })).toMatchObject({ retry: 1, sent: 0 });
      const [row] = await rows();
      expect(row).toMatchObject({ status: "queued", attempts: attempt, error: "Ponudnik pošte je vrnil napako (429)." });
      expect(row.sendAfter.getTime() - at.getTime()).toBe(5 * 60_000 * 2 ** (attempt - 1));
      // Not due before the backoff ends.
      expect(await sendDue({ now: new Date(row.sendAfter.getTime() - 1000), send: fail })).toMatchObject({ retry: 0, sent: 0, deferred: 0 });
      at = row.sendAfter;
    }
    expect(await sendDue({ now: at, send: fail })).toMatchObject({ failed: 1 });
    expect((await rows())[0]).toMatchObject({ status: "failed", attempts: 5 });
  });

  it("holds the mails of a bulletin whose publish was undone; drops those of an unsubscribed reader", async () => {
    await seed(2, { bulletinStatus: "draft" });
    expect(await sendDue({ now: NOW })).toMatchObject({ sent: 0, held: 2 });
    expect((await rows()).every((x) => x.status === "queued")).toBe(true);

    await db.update(schema.bulletins).set({ status: "published" });
    await db.update(s).set({ status: "unsubscribed" }).where(eq(s.email, "n2@primer.si"));
    const later = new Date(NOW.getTime() + 61 * 60_000);
    expect(await sendDue({ now: later })).toMatchObject({ sent: 1, failed: 1 });
    expect((await rows()).map((x) => x.status)).toEqual(["sent", "failed"]);
  });

  it("two overlapping runs never send the same mail twice", async () => {
    await seed(20);
    const seen: string[] = [];
    const slow = async (m: OutgoingMail) => {
      seen.push(m.to);
      await new Promise((r) => setTimeout(r, 5));
      return { ok: true as const, delivered: true };
    };
    await Promise.all([sendDue({ now: NOW, send: slow }), sendDue({ now: NOW, send: slow })]);
    expect(seen).toHaveLength(20);
    expect(new Set(seen).size).toBe(20);
  });
});
