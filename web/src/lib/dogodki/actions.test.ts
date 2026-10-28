import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db, schema } from "@/db";
import { approve } from "@/lib/admin/engine";
import { makeUser, resetDb } from "@/test/db";
import { deleteEvent, saveEvent } from "./actions";
import { getEvent, groupByMonth, listEvents } from "./queries";

const KLJ = { title: "Srečanje ključarjev", date: "2026-11-05", time: "08:00", place: "Marijina cerkev" };

async function setup() {
  const blaz = await makeUser("blaz", { isOwner: true, name: "msgr. dr. Blaž Jezeršek" });
  const marta = await makeUser("marta", { name: "Marta Zupan", sections: ["mase", "oznanila", "dogodki"], requiresApproval: true });
  const ana = await makeUser("ana", { name: "Ana Rozman", sections: ["verouk"] });
  return { blaz, marta, ana };
}

describe("event.save / event.delete", () => {
  beforeEach(resetDb);

  it("Blaž creates the event; Marta creates a change request and no event", async () => {
    const { blaz, marta } = await setup();
    const r = await saveEvent(blaz, KLJ);
    expect(r.status).toBe("applied");
    const evs = await db.select().from(schema.events);
    expect(evs).toHaveLength(1);
    expect(evs[0]).toMatchObject({ title: "Srečanje ključarjev", date: "2026-11-05", time: "08:00:00", createdBy: "blaz" });
    const [h] = await db.select().from(schema.history);
    expect(h.label).toBe("Nov dogodek: Srečanje ključarjev");

    const m = await saveEvent(marta, { ...KLJ, title: "Čiščenje Marijine cerkve", date: "2026-11-07" });
    expect(m.status).toBe("pending");
    expect(await db.select().from(schema.events)).toHaveLength(1);
    const crs = await db.select().from(schema.changeRequests);
    expect(crs).toHaveLength(1);
    expect(crs[0]).toMatchObject({ action: "event.save", section: "dogodki", label: "Nov dogodek: Čiščenje Marijine cerkve" });

    // Approved by Blaž, the event is still Marta's.
    await approve(blaz, crs[0].id);
    const ciscenje = (await db.select().from(schema.events)).find((e) => e.title.startsWith("Čiščenje"))!;
    expect(ciscenje.createdBy).toBe("marta");
  });

  it("validates title, date and time", async () => {
    const { blaz } = await setup();
    await expect(saveEvent(blaz, { ...KLJ, title: "  " })).rejects.toThrow("Vpišite naslov.");
    await expect(saveEvent(blaz, { ...KLJ, date: "" })).rejects.toThrow("Izberite datum in uro.");
    await expect(saveEvent(blaz, { ...KLJ, time: "" })).rejects.toThrow("Izberite datum in uro.");
    const { time: _t, ...noTime } = KLJ;
    await expect(saveEvent(blaz, noTime as typeof KLJ)).rejects.toThrow("Izberite datum in uro.");
    expect(await db.select().from(schema.events)).toHaveLength(0);
  });

  it("edits an event with the label Sprememba dogodka", async () => {
    const { blaz } = await setup();
    await saveEvent(blaz, KLJ);
    const [ev] = await db.select().from(schema.events);
    await saveEvent(blaz, { ...KLJ, id: ev.id, time: "09:00" });
    expect((await db.select().from(schema.events).where(eq(schema.events.id, ev.id)))[0].time).toBe("09:00:00");
    const hs = await db.select().from(schema.history).orderBy(schema.history.id);
    expect(hs[1].label).toBe("Sprememba dogodka: Srečanje ključarjev");
  });

  it("only the owner can delete; Marta and Ana get forbidden", async () => {
    const { blaz, marta, ana } = await setup();
    await saveEvent(blaz, KLJ);
    const [ev] = await db.select().from(schema.events);
    await expect(deleteEvent(marta, ev.id)).rejects.toThrow("forbidden");
    await expect(deleteEvent(ana, ev.id)).rejects.toThrow("forbidden");
    expect(await db.select().from(schema.events)).toHaveLength(1);
    expect(await db.select().from(schema.changeRequests)).toHaveLength(0);
    await deleteEvent(blaz, ev.id);
    expect(await db.select().from(schema.events)).toHaveLength(0);
    const hs = await db.select().from(schema.history).orderBy(schema.history.id);
    expect(hs.at(-1)!.label).toBe("Izbrisan dogodek: Srečanje ključarjev");
  });

  it("lists upcoming events with pending new events and edits", async () => {
    const { blaz, marta } = await setup();
    await saveEvent(blaz, { ...KLJ, title: "Staro", date: "2026-10-20" });
    await saveEvent(blaz, { ...KLJ, title: "Molitev za rajne na pokopališču", date: "2026-11-01", time: "14:00", place: "Pokopališče Pirniče" });
    await saveEvent(blaz, { ...KLJ, title: "Srečanje staršev birmancev", date: "2026-11-13", time: "19:00" });
    const evs = await db.select().from(schema.events);
    const bir = evs.find((e) => e.title.startsWith("Srečanje staršev"))!;
    await saveEvent(marta, { title: "Čiščenje Marijine cerkve", date: "2026-11-07", time: "09:00", place: "Marijina cerkev" });
    await saveEvent(marta, { id: bir.id, title: "Srečanje staršev birmancev", date: "2026-11-13", time: "19:30", place: "Marijina cerkev" });

    const list = await listEvents();
    expect(list.map((e) => e.title)).toEqual(["Molitev za rajne na pokopališču", "Čiščenje Marijine cerkve", "Srečanje staršev birmancev"]);
    expect(list[0]).toMatchObject({ time: "14:00", pending: null });
    expect(list[1]).toMatchObject({ id: null, pending: { isNew: true, by: "marta", byName: "Marta Zupan" } });
    expect(list[2]).toMatchObject({ id: bir.id, time: "19:30", pending: { isNew: false, byName: "Marta Zupan" } });
    expect(groupByMonth(list).map((g) => [g.month, g.items.length])).toEqual([["november", 3]]);

    const one = await getEvent(bir.id);
    expect(one).toMatchObject({ time: "19:00", proposed: { time: "19:30" } });
    expect(await getEvent(9999)).toBeNull();

    // Approving the edit applies it.
    const cr = (await db.select().from(schema.changeRequests)).find((c) => (c.payload as { id?: number }).id === bir.id)!;
    await approve(blaz, cr.id);
    expect((await getEvent(bir.id))).toMatchObject({ time: "19:30", proposed: null });
  });
});
