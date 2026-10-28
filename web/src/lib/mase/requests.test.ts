import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db, schema } from "@/db";
import { loadActor } from "@/lib/admin/actor";
import { approve, perform, undo } from "@/lib/admin/engine";
import type { Actor } from "@/lib/admin/sections";
import { PARISH, seedSettings } from "@/lib/forms/test-support";
import { clearDevOutbox, devOutbox } from "@/lib/mail";
import { ensureMasses } from "@/lib/mase/ensure";
import { resetDb } from "@/test/db";
import { seedParish } from "@/test/seed";
import "./actions";
import { countNewIntentionRequests, intentionPrefill, listIntentionRequests, submitIntentionRequest } from "./requests";

let blaz: Actor, marta: Actor, ana: Actor;
const requests = () => db.select().from(schema.intentionRequests);
const request = async (id: number) => (await db.select().from(schema.intentionRequests).where(eq(schema.intentionRequests.id, id)))[0];

const ANA = { name: "Ana Kralj", contact: "041 123 456", text: "+ Franc Kralj, obl.", date: "2026-11-15", church: "marijino-vnebovzetje", note: "Če gre, ob 10. uri." };

async function massOn(date: string) {
  await ensureMasses(db, date, date);
  const [m] = await db.select().from(schema.masses).where(eq(schema.masses.date, date));
  return m;
}

describe("Mass-intention requests (US-007)", () => {
  beforeEach(async () => {
    await resetDb();
    await seedParish(db);
    await seedSettings();
    clearDevOutbox();
    [blaz, marta, ana] = (await Promise.all(["blaz", "marta", "ana"].map((id) => loadActor(db, id)))) as Actor[];
  });

  it("stores a new request and mails the parish once", async () => {
    const r = await submitIntentionRequest(ANA, { ip: "1.1.1.1" });
    expect(r.ok).toBe(true);
    const [row] = await requests();
    expect(row).toMatchObject({
      status: "new",
      name: "Ana Kralj",
      contact: "041 123 456",
      text: "+ Franc Kralj, obl.",
      preferredDate: "2026-11-15",
      churchSlug: "marijino-vnebovzetje",
      note: "Če gre, ob 10. uri.",
    });
    expect(devOutbox().map((m) => m.to)).toEqual([PARISH]);
    expect(devOutbox()[0].text).toContain("Franc Kralj");
    expect(await countNewIntentionRequests()).toBe(1);
  });

  it("date and church are optional; a contact is required", async () => {
    expect((await submitIntentionRequest({ name: "Ana", contact: "ana@example.com", text: "v zahvalo" }, { ip: "1.1.1.1" })).ok).toBe(true);
    const r = await submitIntentionRequest({ name: "Ana", contact: "", text: "v zahvalo" }, { ip: "1.1.1.1" });
    expect(r).toMatchObject({ ok: false, fieldErrors: { contact: "Vpišite telefon ali e-poštni naslov." } });
  });

  it("rejects a text over 200 characters and a date in the past", async () => {
    const long = await submitIntentionRequest({ ...ANA, text: "x".repeat(201) }, { ip: "1.1.1.1" });
    expect(long).toMatchObject({ ok: false, fieldErrors: { text: "Namen je predolg (največ 200 znakov)." } });
    const past = await submitIntentionRequest({ ...ANA, date: "2026-10-01" }, { ip: "1.1.1.1" });
    expect(past).toMatchObject({ ok: false, fieldErrors: { date: "Izberite datum v prihodnosti." } });
    expect(await requests()).toHaveLength(0);
    expect(devOutbox()).toHaveLength(0);
  });

  it("converting creates the intention through intention.add and marks the request done; undo reverts both", async () => {
    await submitIntentionRequest(ANA, { ip: "1.1.1.1" });
    const [req] = await requests();
    const mass = await massOn("2026-11-15");
    const pre = intentionPrefill(req.text);
    expect(pre).toEqual({ text: "Franc Kralj, obl.", kind: "deceased" });

    const r = await perform(blaz, "intention.add", { massId: mass.id, ...pre, requestId: req.id });
    expect(r.status).toBe("applied");
    const [it] = await db.select().from(schema.intentions).where(eq(schema.intentions.massId, mass.id));
    expect(it.text).toBe("Franc Kralj, obl.");
    expect(await request(req.id)).toMatchObject({ status: "done", intentionId: it.id, decidedBy: "blaz" });
    expect(await listIntentionRequests()).toHaveLength(0);
    const [h] = await db.select().from(schema.history);
    expect(h.label).toBe("Nov namen † Franc Kralj, obl.");

    // Converting twice is refused.
    await expect(perform(blaz, "intention.add", { massId: mass.id, ...pre, requestId: req.id })).rejects.toThrow("Ta prošnja je že obravnavana.");

    await undo(blaz, (r as { historyId: number }).historyId);
    expect(await db.select().from(schema.intentions).where(eq(schema.intentions.massId, mass.id))).toHaveLength(0);
    expect(await request(req.id)).toMatchObject({ status: "new", intentionId: null });
  });

  it("decline asks for an optional note, is in history and can be undone", async () => {
    await submitIntentionRequest(ANA, { ip: "1.1.1.1" });
    const [req] = await requests();
    const r = await perform(blaz, "intentionRequest.decline", { requestId: req.id, note: "Ta dan je že poln." });
    expect(await request(req.id)).toMatchObject({ status: "declined", declineNote: "Ta dan je že poln.", decidedBy: "blaz" });
    const [h] = await db.select().from(schema.history);
    expect(h).toMatchObject({ section: "mase", action: "intentionRequest.decline" });
    await undo(blaz, (r as { historyId: number }).historyId);
    expect(await request(req.id)).toMatchObject({ status: "new", declineNote: null });
    // Only the Mase area may decline.
    await expect(perform(ana, "intentionRequest.decline", { requestId: req.id })).rejects.toThrow("forbidden");
  });

  it("a helper who needs approval: change request, the request stays new until approved", async () => {
    await submitIntentionRequest(ANA, { ip: "1.1.1.1" });
    const [req] = await requests();
    const mass = await massOn("2026-11-15");
    const r = await perform(marta, "intention.add", { massId: mass.id, text: "Franc Kralj, obl.", kind: "deceased", requestId: req.id });
    expect(r.status).toBe("pending");
    expect(await request(req.id)).toMatchObject({ status: "new" });
    const [listed] = await listIntentionRequests();
    expect(listed.pendingBy).toBe("Marta Zupan");

    await approve(blaz, (r as { changeRequestId: number }).changeRequestId);
    const done = await request(req.id);
    expect(done.status).toBe("done");
    expect(done.intentionId).not.toBeNull();
    const [it] = await db.select().from(schema.intentions).where(eq(schema.intentions.id, done.intentionId!));
    expect(it).toMatchObject({ massId: mass.id, createdBy: "marta" });
  });
});
