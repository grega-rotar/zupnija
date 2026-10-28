import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db, schema } from "@/db";
import { approve, undo } from "@/lib/admin/engine";
import { clearDevOutbox, devOutbox } from "@/lib/mail";
import { publishBulletin } from "@/lib/bulletin/service";
import { makeUser, resetDb } from "@/test/db";
import type { Actor } from "@/lib/admin/sections";
import "@/lib/bulletin/actions";
import { CONFIRM_SUBJECT } from "./content";
import { submitSubscribe } from "./form";
import { confirm, newsletterStats, subscribe, unsubscribe } from "./service";

const s = schema.newsletterSubscribers;
const sub = async (email: string) => (await db.select().from(s).where(eq(s.email, email)))[0];

let owner: Actor;
beforeEach(async () => {
  await resetDb();
  clearDevOutbox();
  owner = await makeUser("blaz", { isOwner: true });
});

describe("subscribe, confirm, unsubscribe [db]", () => {
  it("a new address: a pending row with token and consent, and exactly one confirmation mail", async () => {
    await subscribe("Vas@Primer.si ");
    const row = await sub("vas@primer.si");
    expect(row).toMatchObject({ status: "pending", confirmedAt: null });
    expect(row.token).toMatch(/^[\w-]{32}$/);
    expect(row.consentAt).toBeInstanceOf(Date);
    const mails = devOutbox();
    expect(mails).toHaveLength(1);
    expect(mails[0]).toMatchObject({ to: "vas@primer.si", subject: CONFIRM_SUBJECT });
    expect(mails[0].text).toContain(`/obvestila/potrdi?token=${row.token}`);
    expect(mails[0].html).toContain(`/obvestila/potrdi?token=${row.token}`);
  });

  it("confirm: active once; the same token again changes nothing; an unknown token is invalid", async () => {
    await subscribe("vas@primer.si");
    const { token } = await sub("vas@primer.si");
    expect(await confirm(token)).toBe("confirmed");
    const first = await sub("vas@primer.si");
    expect(first.status).toBe("active");
    expect(first.confirmedAt).toBeInstanceOf(Date);
    expect(await confirm(token)).toBe("already");
    expect(await sub("vas@primer.si")).toEqual(first);
    expect(await confirm("ni-tega")).toBe("invalid");
    expect(await confirm("")).toBe("invalid");
  });

  it("an active address subscribing again gets no mail and stays active", async () => {
    await subscribe("vas@primer.si");
    await confirm((await sub("vas@primer.si")).token);
    clearDevOutbox();
    await subscribe("vas@primer.si");
    expect(devOutbox()).toHaveLength(0);
    expect((await sub("vas@primer.si")).status).toBe("active");
    expect(await db.select().from(s)).toHaveLength(1);
  });

  it("unsubscribe sets unsubscribed and drops queued newsletter mails; subscribing again needs a new confirmation", async () => {
    await subscribe("vas@primer.si");
    const { token } = await sub("vas@primer.si");
    await confirm(token);
    await db.insert(schema.outbox).values({ kind: "newsletter", ref: "bulletin:1", to: "vas@primer.si", subject: "x", text: "x" });
    expect(await unsubscribe(token)).toBe("done");
    expect(await sub("vas@primer.si")).toMatchObject({ status: "unsubscribed" });
    expect((await db.select().from(schema.outbox))[0]).toMatchObject({ status: "failed" });
    expect(await unsubscribe(token)).toBe("done");
    expect(await unsubscribe("ni-tega")).toBe("invalid");
    expect(await confirm(token)).toBe("invalid");

    clearDevOutbox();
    await subscribe("vas@primer.si");
    expect((await sub("vas@primer.si")).status).toBe("pending");
    expect(devOutbox()).toHaveLength(1);
  });
});

// ── Publishing ──────────────────────────────────────────────────────────────
async function seedSubscribers() {
  const at = new Date("2026-10-20T10:00:00Z");
  await db.insert(s).values([
    { email: "a@primer.si", token: "tok-a", status: "active", consentAt: at, confirmedAt: at },
    { email: "b@primer.si", token: "tok-b", status: "active", consentAt: at, confirmedAt: at },
    { email: "c@primer.si", token: "tok-c", status: "active", consentAt: at, confirmedAt: at },
    { email: "d@primer.si", token: "tok-d", status: "pending", consentAt: at },
    { email: "e@primer.si", token: "tok-e", status: "unsubscribed", consentAt: at, unsubscribedAt: at },
  ]);
}

async function seedBulletin(withPdf = true) {
  const [up] = withPdf
    ? await db.insert(schema.uploads).values({ filename: "oznanila.pdf", mime: "application/pdf", size: 5, path: "x.pdf", sha256: "x" }).returning()
    : [null];
  const [b] = await db
    .insert(schema.bulletins)
    .values({
      periodStart: "2026-10-01",
      periodEnd: "2026-10-31",
      title: "Oktober 2026",
      status: "draft",
      uploadId: up?.id ?? null,
      draft: {
        readable: true,
        period: { start: "2026-10-01", end: "2026-10-31", title: "Oktober 2026", issue: "Leto XLII, številka 10" },
        days: [],
        notices: [
          { id: "n1", text: "Rožni venec vsak dan pol ure pred mašo." },
          { id: "n2", text: "Zbiramo prijave za birmo." },
        ],
        events: [
          { id: "e1", title: "Seja ŽPS", date: "2026-10-06", time: "19:15", place: "župnišče", include: true },
          { id: "e2", title: "Romanje", date: "2026-10-18", time: "07:00", include: false },
        ],
        article: { title: "Mesec rožnega venca", text: "Oktober je posvečen molitvi rožnega venca." },
      },
    })
    .returning();
  return b.id;
}

const queued = () => db.select().from(schema.outbox).orderBy(schema.outbox.id);

describe("publishing queues the newsletter [db]", () => {
  it("3 active + 1 pending + 1 unsubscribed → exactly 3 mails, each complete, with List-Unsubscribe headers", async () => {
    await seedSubscribers();
    const id = await seedBulletin();
    const r = await publishBulletin(owner, { bulletinId: id });
    expect(r.status).toBe("applied");
    expect(devOutbox()).toHaveLength(0); // nothing goes out in the publish request

    const mails = await queued();
    expect(mails.map((m) => m.to)).toEqual(["a@primer.si", "b@primer.si", "c@primer.si"]);
    for (const m of mails) {
      expect(m).toMatchObject({ kind: "newsletter", ref: `bulletin:${id}`, status: "queued", subject: "Oznanila za oktober 2026" });
      const token = `tok-${m.to[0]}`;
      for (const body of [m.text, m.html!]) {
        expect(body).toContain("Mesec rožnega venca");
        expect(body).toContain("Rožni venec vsak dan pol ure pred mašo.");
        expect(body).toContain("Zbiramo prijave za birmo.");
        expect(body).toContain("Seja ŽPS");
        expect(body).not.toContain("Romanje");
        expect(body).toContain("http://localhost:3000/oznanila");
        expect(body).toContain("/oznanila/2026-10-01/oznanila.pdf");
        expect(body).toContain(`/obvestila/odjava?token=${token}`);
      }
      expect(m.text).toContain("Torek, 6. oktober ob 19.15, župnišče");
      expect(m.headers).toEqual({
        "List-Unsubscribe": `<http://localhost:3000/obvestila/odjava?token=${token}>`,
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      });
    }
    const [b] = await db.select().from(schema.bulletins).where(eq(schema.bulletins.id, id));
    expect(b.mailedAt).toBeInstanceOf(Date);
  });

  it("without a PDF upload the mail has no PDF link", async () => {
    await seedSubscribers();
    const id = await seedBulletin(false);
    await publishBulletin(owner, { bulletinId: id });
    const [m] = await queued();
    expect(m.text).not.toContain("PDF");
  });

  it("undo sends nothing and keeps mailed_at; publishing again does not queue again", async () => {
    await seedSubscribers();
    const id = await seedBulletin();
    const r = await publishBulletin(owner, { bulletinId: id });
    if (r.status !== "applied") throw new Error("not applied");
    const [first] = await db.select().from(schema.bulletins).where(eq(schema.bulletins.id, id));

    await undo(owner, r.historyId);
    const [after] = await db.select().from(schema.bulletins).where(eq(schema.bulletins.id, id));
    expect(after.status).toBe("draft");
    expect(after.mailedAt).toEqual(first.mailedAt);
    expect(await queued()).toHaveLength(3);
    expect(devOutbox()).toHaveLength(0);

    const again = await publishBulletin(owner, { bulletinId: id });
    expect(again.status).toBe("applied");
    expect(await queued()).toHaveLength(3);
  });

  it("a helper's publish queues nothing until the owner approves it", async () => {
    await seedSubscribers();
    const helper = await makeUser("marta", { requiresApproval: true, sections: ["oznanila"] });
    const id = await seedBulletin();
    const r = await publishBulletin(helper, { bulletinId: id });
    if (r.status !== "pending") throw new Error("not pending");
    expect(await queued()).toHaveLength(0);
    await approve(owner, r.changeRequestId);
    expect(await queued()).toHaveLength(3);
  });

  it("no active subscribers: nothing queued, but mailed_at is set so a later subscriber does not get an old bulletin", async () => {
    const id = await seedBulletin();
    await publishBulletin(owner, { bulletinId: id });
    expect(await queued()).toHaveLength(0);
    const [b] = await db.select().from(schema.bulletins).where(eq(schema.bulletins.id, id));
    expect(b.mailedAt).toBeInstanceOf(Date);
  });
});

describe("editor numbers [db]", () => {
  it("counts subscribers and the last bulletin's sending", async () => {
    await seedSubscribers();
    const id = await seedBulletin();
    await publishBulletin(owner, { bulletinId: id });
    await db.update(schema.outbox).set({ status: "sent", sentAt: new Date() });
    const st = await newsletterStats();
    expect(st).toMatchObject({ active: 3, pending: 1, unsubscribed: 1, last: { title: "Oktober 2026", sent: 3, total: 3, queued: 0, failed: 0 } });
    expect(st.subscribers).toHaveLength(5);
  });
});

// ── The form (lib/forms/public.ts) ──────────────────────────────────────────
const form = (values: Record<string, string>) => {
  const fd = new FormData();
  for (const [k, v] of Object.entries(values)) fd.set(k, v);
  return fd;
};

describe("the subscribe form [db]", () => {
  it("a valid address: the thank-you text with the address, a pending row and one mail", async () => {
    const r = await submitSubscribe(form({ email: "vas@primer.si", website: "" }), "1.2.3.4");
    expect(r).toEqual({ ok: true, message: "Hvala. Na vas@primer.si smo poslali povezavo za potrditev." });
    expect(await sub("vas@primer.si")).toMatchObject({ status: "pending" });
    expect(devOutbox()).toHaveLength(1);
  });

  it("an already active address gets the same text and no mail", async () => {
    await db.insert(s).values({ email: "vas@primer.si", token: "t", status: "active", consentAt: new Date() });
    const r = await submitSubscribe(form({ email: "vas@primer.si" }), "1.2.3.4");
    expect(r).toEqual({ ok: true, message: "Hvala. Na vas@primer.si smo poslali povezavo za potrditev." });
    expect(devOutbox()).toHaveLength(0);
  });

  it("abc → the field error and no row", async () => {
    const r = await submitSubscribe(form({ email: "abc" }), "1.2.3.4");
    expect(r).toMatchObject({ ok: false, message: "Vpišite veljaven e-poštni naslov.", fieldErrors: { email: "Vpišite veljaven e-poštni naslov." } });
    expect(await db.select().from(s)).toHaveLength(0);
    expect(devOutbox()).toHaveLength(0);
  });

  it("the honeypot filled → the thank-you text, no row, no mail", async () => {
    const r = await submitSubscribe(form({ email: "vas@primer.si", website: "http://spam.example" }), "1.2.3.4");
    expect(r).toEqual({ ok: true, message: "Hvala. Na vas@primer.si smo poslali povezavo za potrditev." });
    expect(await db.select().from(s)).toHaveLength(0);
    expect(devOutbox()).toHaveLength(0);
  });

  it("the 6th request from one IP in 10 minutes is refused and stores nothing", async () => {
    for (let i = 1; i <= 5; i++) expect((await submitSubscribe(form({ email: `n${i}@primer.si` }), "9.9.9.9")).ok).toBe(true);
    const r = await submitSubscribe(form({ email: "n6@primer.si" }), "9.9.9.9");
    expect(r).toMatchObject({ ok: false, message: "Preveč poskusov. Poskusite čez nekaj minut." });
    expect(await sub("n6@primer.si")).toBeUndefined();
    expect(await db.select().from(s)).toHaveLength(5);
    // Another IP is not affected.
    expect((await submitSubscribe(form({ email: "n6@primer.si" }), "8.8.8.8")).ok).toBe(true);
  });
});
