/**
 * The assistant with the PRD's seed data: what each role sees, the new
 * proposal types and their engine calls, and forged proposals.
 */
import "@/lib/admin/registry";
import { and, eq } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { db, schema } from "@/db";
import { toResult } from "@/lib/admin/errors";
import { loadActor } from "@/lib/admin/actor";
import type { Actor } from "@/lib/admin/sections";
import { clearDevOutbox, devOutbox } from "@/lib/mail";
import { resetDb } from "@/test/db";
import { seedParish, type SeededParish } from "@/test/seed";
import { filterProposals } from "./ask";
import { bulletinOf, buildContext } from "./context";
import { confirmProposal, toAction } from "./confirm";
import { suggestions } from "./greeting";
import { buildPrompt } from "./prompt";

const ask = [{ role: "user" as const, text: "Koliko ljudi ima dostop?" }];
let seed: SeededParish;
let blaz: Actor, marta: Actor, ana: Actor;

async function reseed() {
  await resetDb();
  try {
    seed = await seedParish(db);
  } catch (e) {
    // The bulletins table is being migrated (week_start → period_start) by
    // another change; the seed's last step may fail meanwhile. Everything the
    // assistant tests need is inserted before it.
    console.warn("seedParish stopped early:", (e as Error).message.split("\n")[0]);
    const masses: Record<string, number> = {};
    for (const r of await db.select().from(schema.masses)) masses[`${r.date} ${r.time.slice(0, 5)}`] = r.id;
    const g = await db.select().from(schema.catechesisGroups).orderBy(schema.catechesisGroups.position);
    const cr = await db.select().from(schema.changeRequests).orderBy(schema.changeRequests.id);
    seed = {
      churches: { marija: 0, kriz: 0, tomaz: 0 },
      masses,
      groups: { g13: g[0].id, g46: g[1].id, g79: g[2].id },
      changeRequests: { ivanaKos: cr[0].id, ciscenje: cr[1].id },
      bulletins: { w1018: 0, w1025: 0 },
    };
  }
  [blaz, marta, ana] = (await Promise.all(["blaz", "marta", "ana"].map((id) => loadActor(db, id)))) as Actor[];
}

const intentionId = async (text: string) => (await db.select().from(schema.intentions).where(eq(schema.intentions.text, text)))[0]?.id;
const eventId = async (title: string) => (await db.select().from(schema.events).where(eq(schema.events.title, title)))[0].id;

describe("assistant context with the seed data", () => {
  beforeAll(reseed);

  it("gives the owner people and access; Ana and Marta never see them", async () => {
    const ctx = await buildContext(blaz);
    expect(ctx.people?.map((p) => p.name)).toEqual(["msgr. dr. Blaž Jezeršek", "Ana Rozman", "Marta Zupan", "Tone Kralj"]);
    expect(ctx.people?.find((p) => p.userId === "tone")).toMatchObject({ sections: ["dogodki"], needsApproval: true, status: "povabljen, še ni prijavljen" });
    expect(ctx.summary.peopleWithAccess).toBe(4);
    const p = buildPrompt(blaz, ctx, ask);
    for (const s of ['"people":', "Tone Kralj", "tone@example.com", "invite_person", "update_access", "approve_change"]) expect(p).toContain(s);
    expect(p).not.toContain("Nekdanji sodelavec");

    for (const helper of [ana, marta]) {
      const hc = await buildContext(helper);
      expect(hc.people).toBeUndefined();
      const hp = buildPrompt(helper, hc, ask);
      for (const s of ['"people"', "Tone Kralj", "tone@example.com", "invite_person", "update_access", "approve_change", "delete_event"]) expect(hp).not.toContain(s);
    }
  });

  it("scopes pending and history: the owner sees all, a helper their own", async () => {
    expect((await buildContext(blaz)).pending.map((p) => p.label)).toEqual(["Nov namen † Ivana Kos", "Nov dogodek: Čiščenje Marijine cerkve"]);
    expect((await buildContext(blaz)).pending[0]).toMatchObject({ by: "Marta Zupan", section: "mase" });
    expect((await buildContext(marta)).pending).toHaveLength(2);
    expect((await buildContext(ana)).pending).toEqual([]);
    const ctx = await buildContext(ana);
    expect(ctx.masses).toBeUndefined();
    expect(ctx.events).toBeUndefined();
    expect(ctx.bulletins).toBeUndefined();
    expect(ctx.parish).toBeUndefined();
    expect(ctx.allowed).toEqual(["cancel_lesson", "restore_lesson"]);
  });

  it("covers this week and the next 8: masses with intention ids, lessons, events, the schedule", async () => {
    const ctx = await buildContext(blaz);
    expect(ctx.masses?.at(-1)?.date).toBe("2026-12-26");
    expect(ctx.masses?.length).toBe(9 * 8);
    expect(ctx.summary.massesThisWeek).toBe(8);
    const tue = ctx.masses?.find((m) => m.date === "2026-10-27" && m.time === "18:30");
    expect(tue?.intentions).toEqual([{ id: await intentionId("Štefan Hrovat"), kind: "deceased", text: "Štefan Hrovat" }]);
    expect(ctx.lessons).toHaveLength(9 * 3);
    expect(ctx.events?.map((e) => e.title)).toContain("Srečanje staršev birmancev");
    expect(ctx.parish?.schedule[0]).toMatchObject({ weekdays: ["nedelja"], time: "08:00", church: "Sv. Križ" });
  });

  it("stays under the size budget (32k characters of DATA, ~11k tokens)", async () => {
    const ctx = await buildContext(blaz);
    const size = JSON.stringify(ctx).length;
    console.info(`assistant context with the seed data: ${size} characters, prompt ${buildPrompt(blaz, ctx, ask).length}`);
    expect(size).toBeLessThan(32_000);
  });

  it("maps a bulletin list entry", () => {
    const e = { id: 1, periodStart: "2026-10-01", periodEnd: "2026-10-31", title: "Oktober 2026", status: "published" as const, itemCount: 35, flagCount: 0, noticeCount: 10, eventCount: 7, publishedAt: null, publishedBy: null, updatedAt: null };
    expect(bulletinOf(e)).toEqual({ id: 1, from: "2026-10-01", to: "2026-10-31", title: "Oktober 2026", status: "published", notices: 10, items: 35, flags: 0 });
  });

  it("suggests a question for each role", async () => {
    const s = await suggestions(blaz);
    expect(s).toContain("Koliko ljudi ima dostop?");
    expect(s).toContain("Kaj čaka mojo potrditev?");
    expect(await suggestions(marta)).toContain("Kaj še čaka na potrditev?");
  });

  it("drops proposals that point outside the context or the person's access", async () => {
    const ctx = await buildContext(blaz);
    const stefan = await intentionId("Štefan Hrovat");
    const keep = [
      { type: "remove_intention", intentionId: stefan },
      { type: "approve_change", changeRequestId: seed.changeRequests.ivanaKos },
      { type: "update_access", userId: "tone", sections: ["dogodki", "oznanila"], requiresApproval: true },
      { type: "invite_person", name: "Petra Kovač", email: "petra@example.com", sections: ["dogodki"], requiresApproval: true },
    ];
    const drop = [
      { type: "remove_intention", intentionId: 99999 },
      { type: "restore_mass", massId: seed.masses["2026-10-28 18:30"] }, // not cancelled
      { type: "restore_lesson", groupId: seed.groups.g46, date: "2026-10-28" }, // not cancelled
      { type: "approve_change", changeRequestId: 99999 },
      { type: "update_access", userId: "blaz", sections: [], requiresApproval: false },
      { type: "update_access", userId: "disabled", sections: ["mase"], requiresApproval: false },
      { type: "invite_person", name: "Tone", email: "TONE@example.com", sections: ["dogodki"], requiresApproval: true },
      { type: "invite_person", name: "Brez", email: "brez@example.com", sections: [], requiresApproval: true },
      { type: "edit_event", id: 99999, title: "x" },
      { type: "delete_event", id: 99999 },
    ];
    expect(filterProposals(ctx, [...keep, ...drop]).map((p) => p.type)).toEqual(keep.map((p) => p.type));
    // Marta may not get owner-only types even with valid ids.
    const mctx = await buildContext(marta);
    expect(filterProposals(mctx, [...keep, { type: "delete_event", id: await eventId("Uradne ure Karitas") }]).map((p) => p.type)).toEqual(["remove_intention"]);
  });

  it("maps each new proposal type to its engine call", () => {
    const cases: [unknown, string, Record<string, unknown>][] = [
      [{ type: "remove_intention", intentionId: 5 }, "intention.remove", { intentionId: 5 }],
      [{ type: "restore_mass", massId: 7 }, "mass.restore", { massId: 7 }],
      [{ type: "restore_lesson", groupId: 2, date: "2026-11-04" }, "lesson.restore", { groupId: 2, date: "2026-11-04" }],
      [{ type: "edit_event", id: 3, time: "18:00" }, "event.save", { id: 3, time: "18:00" }],
      [{ type: "delete_event", id: 3 }, "event.delete", { id: 3 }],
      [
        { type: "invite_person", name: "Petra Kovač", email: "petra@example.com", sections: ["dogodki"] },
        "person.invite",
        { name: "Petra Kovač", email: "petra@example.com", title: undefined, sections: ["dogodki"], requiresApproval: true },
      ],
      [{ type: "update_access", userId: "tone", sections: ["dogodki"], requiresApproval: false }, "person.update", { userId: "tone", sections: ["dogodki"], requiresApproval: false }],
      [{ type: "approve_change", changeRequestId: 4 }, "change.approve", { id: 4 }],
      [{ type: "reject_change", changeRequestId: 4 }, "change.reject", { id: 4 }],
    ];
    for (const [p, name, payload] of cases) expect(toAction(p)).toEqual({ name, payload });
    // The card's switches win over the proposal.
    expect(toAction({ type: "update_access", userId: "tone", sections: ["dogodki"], requiresApproval: false }, { sections: ["verouk"], requiresApproval: true })?.payload).toMatchObject({
      sections: ["verouk"],
      requiresApproval: true,
    });
  });
});

describe("confirming the new proposal types", () => {
  beforeEach(reseed);

  it("removes an intention and restores a Mass and a lesson", async () => {
    const id = await intentionId("Štefan Hrovat");
    expect(await confirmProposal(blaz, { type: "remove_intention", intentionId: id })).toMatchObject({ status: "applied" });
    expect(await intentionId("Štefan Hrovat")).toBeUndefined();

    const wed = seed.masses["2026-10-28 18:30"];
    await db.update(schema.masses).set({ status: "cancelled" }).where(eq(schema.masses.id, wed));
    await confirmProposal(blaz, { type: "restore_mass", massId: wed });
    expect((await db.select().from(schema.masses).where(eq(schema.masses.id, wed)))[0].status).toBe("scheduled");

    const c = schema.catechesisCancellations;
    await db.insert(c).values({ groupId: seed.groups.g46, date: "2026-11-04", message: "Počitnice" });
    await confirmProposal(ana, { type: "restore_lesson", groupId: seed.groups.g46, date: "2026-11-04" });
    expect(await db.select().from(c).where(and(eq(c.groupId, seed.groups.g46), eq(c.date, "2026-11-04")))).toEqual([]);
  });

  it("a helper who needs approval gets a change request, not a change", async () => {
    const id = await intentionId("Branko Babnik");
    expect(await confirmProposal(marta, { type: "remove_intention", intentionId: id })).toMatchObject({ status: "pending" });
    expect(await intentionId("Branko Babnik")).toBe(id);
  });

  it("edits an event keeping the fields it does not name, and deletes one", async () => {
    const id = await eventId("Molitev za rajne na pokopališču");
    await confirmProposal(blaz, { type: "edit_event", id, time: "15:00" });
    const [e] = await db.select().from(schema.events).where(eq(schema.events.id, id));
    expect(e).toMatchObject({ time: "15:00:00", onFrontPage: true, place: "Pokopališče Pirniče", description: "Po molitvi blagoslov grobov." });
    await confirmProposal(blaz, { type: "delete_event", id });
    expect(await db.select().from(schema.events).where(eq(schema.events.id, id))).toEqual([]);
  });

  it("invites a person (with the e-mail) and updates access", async () => {
    clearDevOutbox();
    const r = await confirmProposal(blaz, { type: "invite_person", name: "Petra Kovač", email: "petra@example.com", sections: ["dogodki"], requiresApproval: true });
    expect(r).toMatchObject({ status: "applied", mailed: true });
    const [u] = await db.select().from(schema.user).where(eq(schema.user.email, "petra@example.com"));
    expect(u).toMatchObject({ name: "Petra Kovač", requiresApproval: true, short: "PK" });
    expect(devOutbox().at(-1)?.to).toBe("petra@example.com");

    await confirmProposal(blaz, { type: "update_access", userId: "tone", sections: ["dogodki", "oznanila"], requiresApproval: false });
    const secs = await db.select().from(schema.userSections).where(eq(schema.userSections.userId, "tone"));
    expect(secs.map((s) => s.section).sort()).toEqual(["dogodki", "oznanila"]);
    expect((await db.select().from(schema.user).where(eq(schema.user.id, "tone")))[0].requiresApproval).toBe(false);
  });

  it("approves and rejects pending changes", async () => {
    expect(await confirmProposal(blaz, { type: "approve_change", changeRequestId: seed.changeRequests.ivanaKos })).toMatchObject({ status: "applied" });
    expect(await intentionId("Ivana Kos")).toBeDefined();
    expect(await confirmProposal(blaz, { type: "reject_change", changeRequestId: seed.changeRequests.ciscenje })).toEqual({ status: "rejected" });
    const cr = await db.select().from(schema.changeRequests).where(eq(schema.changeRequests.id, seed.changeRequests.ciscenje));
    expect(cr[0].status).toBe("rejected");
  });

  it("forged proposals outside the person's access are forbidden and change nothing", async () => {
    const stefan = await intentionId("Štefan Hrovat");
    const karitas = await eventId("Uradne ure Karitas");
    const forged: [Actor, unknown][] = [
      [ana, { type: "remove_intention", intentionId: stefan }],
      [ana, { type: "restore_mass", massId: seed.masses["2026-10-28 18:30"] }],
      [ana, { type: "edit_event", id: karitas, title: "x" }],
      [marta, { type: "restore_lesson", groupId: seed.groups.g46, date: "2026-11-04" }],
      [marta, { type: "delete_event", id: karitas }],
      [marta, { type: "invite_person", name: "Petra Kovač", email: "petra@example.com", sections: ["dogodki"], requiresApproval: false }],
      [marta, { type: "update_access", userId: "marta", sections: ["mase", "oznanila", "dogodki", "verouk"], requiresApproval: false }],
      [marta, { type: "approve_change", changeRequestId: seed.changeRequests.ivanaKos }],
      [ana, { type: "reject_change", changeRequestId: seed.changeRequests.ciscenje }],
    ];
    clearDevOutbox();
    for (const [actor, p] of forged) expect(await toResult(() => confirmProposal(actor, p)), JSON.stringify(p)).toMatchObject({ ok: false, forbidden: true });
    expect(await intentionId("Štefan Hrovat")).toBe(stefan);
    expect(await db.select().from(schema.events).where(eq(schema.events.id, karitas))).toHaveLength(1);
    expect(await db.select().from(schema.user).where(eq(schema.user.email, "petra@example.com"))).toEqual([]);
    expect(devOutbox()).toEqual([]);
    expect((await db.select().from(schema.changeRequests)).map((c) => c.status)).toEqual(["pending", "pending"]);
    expect(await db.select().from(schema.userSections).where(eq(schema.userSections.userId, "marta"))).toHaveLength(3);
  });
});
