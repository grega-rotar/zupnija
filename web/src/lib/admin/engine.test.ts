import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { db, schema } from "@/db";
import { makeUser, resetDb } from "@/test/db";
import { approve, defineAction, perform, reject, undo } from "./engine";

const addEvent = defineAction({
  name: "test.event.add",
  area: "dogodki",
  approvable: true,
  schema: z.object({ title: z.string().min(1, "Vpišite naslov.") }),
  label: (p) => `Nov dogodek: ${p.title}`,
  apply: (p, { track }) => track.insert("events", { title: p.title, date: "2026-11-05", time: "08:00", place: "Marijina cerkev" }),
  tags: ["events"],
});

const rename = defineAction({
  name: "test.event.rename",
  area: "dogodki",
  approvable: true,
  schema: z.object({ id: z.number(), title: z.string() }),
  label: (p) => `Preimenovan: ${p.title}`,
  apply: (p, { track }) => track.update("events", p.id, { title: p.title }),
  tags: ["events"],
});

describe("engine", () => {
  beforeEach(resetDb);

  it("applies for the owner and records history", async () => {
    const blaz = await makeUser("blaz", { isOwner: true });
    const r = await perform(blaz, addEvent.name, { title: "Srečanje ključarjev" });
    expect(r.status).toBe("applied");
    expect(await db.select().from(schema.events)).toHaveLength(1);
    const [h] = await db.select().from(schema.history);
    expect(h.label).toBe("Nov dogodek: Srečanje ključarjev");
  });

  it("forbids a helper without the section", async () => {
    const ana = await makeUser("ana", { sections: ["verouk"] });
    await expect(perform(ana, addEvent.name, { title: "x" })).rejects.toThrow("forbidden");
    expect(await db.select().from(schema.events)).toHaveLength(0);
  });

  it("validates with the schema's Slovenian message", async () => {
    const blaz = await makeUser("blaz", { isOwner: true });
    await expect(perform(blaz, addEvent.name, { title: "" })).rejects.toThrow("Vpišite naslov.");
  });

  it("queues a helper's change, then the owner approves or rejects", async () => {
    const blaz = await makeUser("blaz", { isOwner: true });
    const marta = await makeUser("marta", { sections: ["dogodki"], requiresApproval: true });
    const r = await perform(marta, addEvent.name, { title: "Čiščenje cerkve" });
    expect(r.status).toBe("pending");
    expect(await db.select().from(schema.events)).toHaveLength(0);
    await expect(approve(marta, (r as { changeRequestId: number }).changeRequestId)).rejects.toThrow("forbidden");
    await approve(blaz, (r as { changeRequestId: number }).changeRequestId);
    expect(await db.select().from(schema.events)).toHaveLength(1);
    const r2 = await perform(marta, addEvent.name, { title: "Drugo" });
    await reject(blaz, (r2 as { changeRequestId: number }).changeRequestId);
    expect(await db.select().from(schema.events)).toHaveLength(1);
  });

  it("undoes inserts and updates, and refuses when changed since", async () => {
    const blaz = await makeUser("blaz", { isOwner: true });
    const a = await perform(blaz, addEvent.name, { title: "A" });
    const ev = (await db.select().from(schema.events))[0];
    const b = await perform(blaz, rename.name, { id: ev.id, title: "B" });
    await expect(undo(blaz, (a as { historyId: number }).historyId)).rejects.toThrow("medtem spremenjeno");
    await undo(blaz, (b as { historyId: number }).historyId);
    expect((await db.select().from(schema.events).where(eq(schema.events.id, ev.id)))[0].title).toBe("A");
    await undo(blaz, (a as { historyId: number }).historyId);
    expect(await db.select().from(schema.events)).toHaveLength(0);
  });
});
