import { and, eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db, schema } from "@/db";
import { loadActor } from "@/lib/admin/actor";
import { approve, perform, undo } from "@/lib/admin/engine";
import type { Actor } from "@/lib/admin/sections";
import { resetDb } from "@/test/db";
import { seedParish, type SeededParish } from "@/test/seed";
import "./actions";

let s: SeededParish;
let blaz: Actor, marta: Actor, ana: Actor;
const intentionsOf = (massId: number) => db.select().from(schema.intentions).where(eq(schema.intentions.massId, massId));

describe("mase actions (US-006, US-007)", () => {
  beforeEach(async () => {
    await resetDb();
    s = await seedParish(db);
    [blaz, marta, ana] = (await Promise.all(["blaz", "marta", "ana"].map((id) => loadActor(db, id)))) as Actor[];
  });

  it("Blaž adds a published intention with one history row", async () => {
    const massId = s.masses["2026-11-01 10:00"];
    const r = await perform(blaz, "intention.add", { massId, text: "Jože Novak", kind: "deceased" });
    expect(r.status).toBe("applied");
    expect((await intentionsOf(massId)).map((i) => i.text)).toEqual(["Jože Novak"]);
    const h = await db.select().from(schema.history);
    expect(h.map((x) => x.label)).toEqual(["Nov namen † Jože Novak"]);
  });

  it("Marta's intention waits as a change request; Ana is forbidden", async () => {
    const massId = s.masses["2026-11-01 10:00"];
    const r = await perform(marta, "intention.add", { massId, text: "Jože Novak", kind: "deceased" });
    expect(r.status).toBe("pending");
    expect(await intentionsOf(massId)).toHaveLength(0);
    const [cr] = await db.select().from(schema.changeRequests).where(eq(schema.changeRequests.id, (r as { changeRequestId: number }).changeRequestId));
    expect([cr.status, cr.action, cr.createdBy]).toEqual(["pending", "intention.add", "marta"]);
    const before = (await db.select().from(schema.changeRequests)).length;
    await expect(perform(ana, "intention.add", { massId, text: "X", kind: "other" })).rejects.toThrow("forbidden");
    expect(await db.select().from(schema.changeRequests)).toHaveLength(before);
  });

  it("validates the intention text", async () => {
    const massId = s.masses["2026-11-01 10:00"];
    await expect(perform(blaz, "intention.add", { massId, text: "", kind: "deceased" })).rejects.toThrow("Vpišite, za koga je namen.");
    await expect(perform(blaz, "intention.add", { massId, text: "x".repeat(201), kind: "deceased" })).rejects.toThrow("Največ 200 znakov.");
  });

  it("cancels Wednesday 18.30 and moves Branko Babnik to Thursday 7.00", async () => {
    const wed = s.masses["2026-10-28 18:30"], thu = s.masses["2026-10-29 07:00"];
    await expect(perform(blaz, "mass.cancel", { massId: wed })).rejects.toThrow("Izberite, kaj naj bo z namenom.");
    await perform(blaz, "mass.cancel", { massId: wed, reason: "Župnik je na duhovnih vajah.", intentionHandling: "next" });
    const [m] = await db.select().from(schema.masses).where(eq(schema.masses.id, wed));
    expect([m.status, m.cancelReason]).toEqual(["cancelled", "Župnik je na duhovnih vajah."]);
    expect(m.editedAt).not.toBeNull();
    expect(m.source).toBe("schedule");
    const moved = await db.select().from(schema.intentions).where(eq(schema.intentions.text, "Branko Babnik"));
    expect(moved.map((i) => [i.massId, i.movedFromMassId])).toEqual([[thu, wed]]);
    const h = await db.select().from(schema.history);
    expect(h.map((x) => x.label)).toEqual(["Odpoved maše: sreda, 28. oktober, 18.30, Marijina cerkev"]);

    await perform(blaz, "mass.restore", { massId: wed });
    const [r] = await db.select().from(schema.masses).where(eq(schema.masses.id, wed));
    expect([r.status, r.cancelReason]).toEqual(["scheduled", null]);
    expect((await intentionsOf(thu)).map((i) => i.text)).toEqual(["v zahvalo", "Branko Babnik"]);
  });

  it("keeps intentions on the cancelled mass with 'keep', and undo restores it", async () => {
    const wed = s.masses["2026-10-28 18:30"];
    const r = await perform(blaz, "mass.cancel", { massId: wed, intentionHandling: "keep" });
    expect((await intentionsOf(wed)).map((i) => i.text)).toEqual(["Branko Babnik"]);
    await undo(blaz, (r as { historyId: number }).historyId);
    const [m] = await db.select().from(schema.masses).where(eq(schema.masses.id, wed));
    expect(m.status).toBe("scheduled");
  });

  it("removes an intention with a label naming it", async () => {
    const [it] = await db.select().from(schema.intentions).where(eq(schema.intentions.text, "Štefan Hrovat"));
    await perform(blaz, "intention.remove", { intentionId: it.id });
    expect(await db.select().from(schema.intentions).where(eq(schema.intentions.id, it.id))).toHaveLength(0);
    const [h] = await db.select().from(schema.history);
    expect(h.label).toBe("Odstranjen namen † Štefan Hrovat");
  });

  it("approves Marta's Ivana Kos; approving after a cancel fails and stays pending", async () => {
    const sun8 = s.masses["2026-11-01 08:00"];
    const { historyId } = await approve(blaz, s.changeRequests.ivanaKos);
    // ActionCtx carries only the approver, so created_by is Blaž; the history note names Marta.
    expect((await intentionsOf(sun8)).map((i) => [i.text, i.kind, i.createdBy])).toEqual([["Ivana Kos", "deceased", "marta"]]);
    const [h] = await db.select().from(schema.history).where(eq(schema.history.id, historyId));
    expect(h.label).toBe("Potrjeno: Nov namen † Ivana Kos");

    const sun10 = s.masses["2026-11-01 10:00"];
    const r = await perform(marta, "intention.add", { massId: sun10, text: "Ana Kos", kind: "deceased" });
    const id = (r as { changeRequestId: number }).changeRequestId;
    await perform(blaz, "mass.cancel", { massId: sun10 });
    await expect(approve(blaz, id)).rejects.toThrow("Maša je bila medtem odpovedana.");
    const [cr] = await db.select().from(schema.changeRequests).where(eq(schema.changeRequests.id, id));
    expect(cr.status).toBe("pending");
    expect(await intentionsOf(sun10)).toHaveLength(0);
  });

  it("Marta's cancel is a pending request and changes no mass", async () => {
    const wed = s.masses["2026-10-28 18:30"];
    const r = await perform(marta, "mass.cancel", { massId: wed, intentionHandling: "next" });
    expect(r.status).toBe("pending");
    const [m] = await db.select().from(schema.masses).where(and(eq(schema.masses.id, wed)));
    expect(m.status).toBe("scheduled");
  });
});
