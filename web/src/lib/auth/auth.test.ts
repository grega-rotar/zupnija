/** Sign-in rules (US-002) and session revocation (US-011). */
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db, schema } from "@/db";
import { auth, loginErrorMessage, revokeSessions, verifyMagicLink } from "@/lib/auth";
import { clearDevOutbox, devOutbox } from "@/lib/mail";
import { makeUser, resetDb } from "@/test/db";

delete process.env.RESEND_API_KEY;

const send = (email: string) => auth.api.signInMagicLink({ body: { email }, headers: new Headers() });
const tokenFrom = (text: string) => /[?&]token=([^\s&]+)/.exec(text)?.[1] ?? "";

beforeEach(async () => {
  await resetDb();
  clearDevOutbox();
});

describe("magic link, invite only", () => {
  it("sends exactly one email to an existing user, linking to /prijava/potrdi, valid 15 minutes", async () => {
    await makeUser("marta", { name: "Marta Zupan" });
    const res = await send("marta@example.com");
    expect(res).toEqual({ status: true });

    const mails = devOutbox();
    expect(mails).toHaveLength(1);
    expect(mails[0].to).toBe("marta@example.com");
    expect(mails[0].text).toMatch(/\/prijava\/potrdi\?token=\w+/);

    const [v] = await db.select().from(schema.verification);
    const minutes = (v.expiresAt.getTime() - Date.now()) / 60000;
    expect(minutes).toBeGreaterThan(14);
    expect(minutes).toBeLessThanOrEqual(15);
  });

  it("sends nothing to an unknown address, with the same response", async () => {
    const res = await send("nekdo@example.com");
    expect(res).toEqual({ status: true });
    expect(devOutbox()).toHaveLength(0);
  });

  it("sends nothing to a disabled user", async () => {
    await makeUser("tone");
    await db.update(schema.user).set({ disabledAt: new Date() }).where(eq(schema.user.id, "tone"));
    expect(await send("tone@example.com")).toEqual({ status: true });
    expect(devOutbox()).toHaveLength(0);
  });

  it("a link works once: session + lastSeenAt, then the reused-link message and no session", async () => {
    await makeUser("marta");
    await send("marta@example.com");
    const token = tokenFrom(devOutbox()[0].text);

    const first = await verifyMagicLink(token, new Headers());
    expect(first.status).toBe(302);
    expect(new URL(first.headers.get("location")!).pathname).toBe("/");
    expect(first.headers.get("set-cookie")).toContain("better-auth.session_token");
    expect(await db.select().from(schema.session)).toHaveLength(1);
    const [u] = await db.select().from(schema.user).where(eq(schema.user.id, "marta"));
    expect(u.lastSeenAt).not.toBeNull();

    const second = await verifyMagicLink(token, new Headers());
    const loc = new URL(second.headers.get("location")!);
    expect(loc.pathname).toBe("/prijava");
    expect(loginErrorMessage(loc.searchParams.get("error"))).toBe("Povezava je že bila uporabljena. Zahtevajte novo.");
    expect(await db.select().from(schema.session)).toHaveLength(1);
  });

  it("a user disabled after the link was sent gets no session", async () => {
    await makeUser("marta");
    await send("marta@example.com");
    await db.update(schema.user).set({ disabledAt: new Date() }).where(eq(schema.user.id, "marta"));

    const res = await verifyMagicLink(tokenFrom(devOutbox()[0].text), new Headers());
    const loc = new URL(res.headers.get("location")!);
    expect(loginErrorMessage(loc.searchParams.get("error"))).toBe("Ta e-pošta nima dostopa. Prosite župnika za povabilo.");
    expect(await db.select().from(schema.session)).toHaveLength(0);
  });
});

describe("revokeSessions", () => {
  it("deletes every session of that user and no one else's", async () => {
    await makeUser("marta");
    await makeUser("ana");
    const later = new Date(Date.now() + 86400_000);
    await db.insert(schema.session).values([
      { id: "s1", token: "t1", userId: "marta", expiresAt: later },
      { id: "s2", token: "t2", userId: "marta", expiresAt: later },
      { id: "s3", token: "t3", userId: "ana", expiresAt: later },
    ]);

    await revokeSessions(db, "marta");

    const left = await db.select().from(schema.session);
    expect(left.map((s) => s.id)).toEqual(["s3"]);
  });
});
