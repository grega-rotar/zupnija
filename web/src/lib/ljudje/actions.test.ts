import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { db, schema } from "@/db";
import { loadActor } from "@/lib/admin/actor";
import { undo } from "@/lib/admin/engine";
import { saveEvent } from "@/lib/dogodki/actions";
import { makeUser, resetDb } from "@/test/db";
import { initials, invitePerson, revokeAccess, updateAccess } from "./actions";
import { listPeople } from "./queries";

const sent = vi.hoisted(() => [] as { to: string; subject: string; text: string }[]);
vi.mock("@/lib/mail", () => ({
  sendMail: vi.fn(async (m: { to: string; subject: string; text: string }) => {
    sent.push(m);
    return { ok: true, delivered: true };
  }),
}));

const PETRA = { name: "Petra Kovač", email: "petra@example.com", title: "Karitas", sections: ["dogodki" as const], requiresApproval: true };

async function setup() {
  const blaz = await makeUser("blaz", { isOwner: true, name: "msgr. dr. Blaž Jezeršek" });
  const marta = await makeUser("marta", { name: "Marta Zupan", sections: ["mase", "oznanila", "dogodki"], requiresApproval: true });
  const ana = await makeUser("ana", { name: "Ana Rozman", sections: ["verouk"] });
  return { blaz, marta, ana };
}

const EVENT = { title: "Srečanje ključarjev", date: "2026-11-05", time: "08:00", place: "Marijina cerkev" };

describe("people and access", () => {
  beforeEach(async () => {
    sent.length = 0;
    process.env.BETTER_AUTH_URL = "https://admin.zupnija-pirnice.si";
    await resetDb();
  });

  it("invite creates one invited user with sections and sends one e-mail with the sign-in link", async () => {
    const { blaz } = await setup();
    const r = await invitePerson(blaz, PETRA);
    expect(r).toMatchObject({ status: "applied", mailed: true });
    const [u] = await db.select().from(schema.user).where(eq(schema.user.email, "petra@example.com"));
    expect(u).toMatchObject({ name: "Petra Kovač", short: "PK", title: "Karitas", emailVerified: false, requiresApproval: true, isOwner: false });
    expect(u.invitedAt).not.toBeNull();
    const secs = await db.select().from(schema.userSections).where(eq(schema.userSections.userId, u.id));
    expect(secs.map((s) => s.section)).toEqual(["dogodki"]);
    expect(sent).toHaveLength(1);
    expect(sent[0].to).toBe("petra@example.com");
    expect(sent[0].text).toContain("https://admin.zupnija-pirnice.si/prijava");
    expect(sent[0].text).toContain("msgr. dr. Blaž Jezeršek");
    const [h] = await db.select().from(schema.history);
    expect(h).toMatchObject({ section: "ljudje", label: "Povabilo: Petra Kovač" });
  });

  it("inviting an existing e-mail returns Ta oseba že ima dostop. and sends nothing", async () => {
    const { blaz } = await setup();
    await expect(invitePerson(blaz, { ...PETRA, email: "Marta@Example.com" })).rejects.toThrow("Ta oseba že ima dostop.");
    expect(sent).toHaveLength(0);
    expect(await db.select().from(schema.user)).toHaveLength(3);
  });

  it("updateAccess takes effect on Marta's next request", async () => {
    const { blaz, marta } = await setup();
    await updateAccess(blaz, { userId: "marta", sections: ["mase"], requiresApproval: false });
    const fresh = (await loadActor(db, "marta"))!;
    expect(fresh).toMatchObject({ sections: ["mase"], requiresApproval: false });
    await expect(saveEvent(fresh, EVENT)).rejects.toThrow("forbidden");
    expect(marta.sections).toContain("dogodki"); // the old actor object is irrelevant: each request loads anew
    const [h] = await db.select().from(schema.history);
    expect(h.label).toBe("Dostop za Marta Zupan");
    await expect(updateAccess(blaz, { userId: "blaz", sections: [], requiresApproval: true })).rejects.toThrow("Njegovega dostopa");
  });

  it("revokeAccess deletes Marta's sessions and sets disabled_at", async () => {
    const { blaz } = await setup();
    const exp = new Date("2026-11-27T10:00:00Z");
    await db.insert(schema.session).values([
      { id: "s1", token: "t1", userId: "marta", expiresAt: exp },
      { id: "s2", token: "t2", userId: "marta", expiresAt: exp },
      { id: "s3", token: "t3", userId: "ana", expiresAt: exp },
    ]);
    await revokeAccess(blaz, "marta");
    const [u] = await db.select().from(schema.user).where(eq(schema.user.id, "marta"));
    expect(u.disabledAt).not.toBeNull();
    expect((await db.select().from(schema.session)).map((s) => s.userId)).toEqual(["ana"]);
    expect(await loadActor(db, "marta")).toBeNull();
    const [h] = await db.select().from(schema.history);
    expect(h.label).toBe("Odvzet dostop: Marta Zupan");
    expect((await listPeople()).map((p) => p.id)).not.toContain("marta");

    await undo(blaz, h.id);
    expect(await loadActor(db, "marta")).not.toBeNull();
  });

  it("nobody can revoke the owner, and only the owner can call people actions", async () => {
    const { blaz, marta, ana } = await setup();
    await expect(revokeAccess(blaz, "blaz")).rejects.toThrow("Župniku ni mogoče odvzeti dostopa.");
    for (const who of [marta, ana]) {
      await expect(revokeAccess(who, "blaz")).rejects.toThrow("forbidden");
      await expect(revokeAccess(who, "ana")).rejects.toThrow("forbidden");
      await expect(updateAccess(who, { userId: "ana", sections: ["verouk"], requiresApproval: false })).rejects.toThrow("forbidden");
      await expect(invitePerson(who, PETRA)).rejects.toThrow("forbidden");
    }
    expect(sent).toHaveLength(0);
    expect(await db.select().from(schema.history)).toHaveLength(0);
    expect(await db.select().from(schema.changeRequests)).toHaveLength(0);
    const [u] = await db.select().from(schema.user).where(eq(schema.user.id, "blaz"));
    expect(u.disabledAt).toBeNull();
  });

  it("listPeople: owner first, then by name, with invited flag and sections", async () => {
    const { blaz } = await setup();
    await invitePerson(blaz, { ...PETRA, name: "Tone Kralj", email: "tone@example.com", title: "Zborovodja" });
    await db.update(schema.user).set({ lastSeenAt: new Date() }).where(eq(schema.user.id, "marta"));
    const people = await listPeople();
    expect(people.map((p) => p.name)).toEqual(["msgr. dr. Blaž Jezeršek", "Ana Rozman", "Marta Zupan", "Tone Kralj"]);
    expect(people[0]).toMatchObject({ isOwner: true, sections: ["mase", "oznanila", "dogodki", "verouk", "vsebina", "zupnija"], requiresApproval: false });
    expect(people[2]).toMatchObject({ invited: false, sections: ["mase", "oznanila", "dogodki"], requiresApproval: true });
    expect(people[3]).toMatchObject({ invited: true, sections: ["dogodki"], short: "TK" });
  });

  it("initials skip titles", () => {
    expect(initials("msgr. dr. Blaž Jezeršek")).toBe("BJ");
    expect(initials("Petra Kovač")).toBe("PK");
  });
});
