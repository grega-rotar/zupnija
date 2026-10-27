import { beforeEach, describe, expect, it } from "vitest";
import { db, schema } from "@/db";
import { undo } from "@/lib/admin/engine";
import { makeUser, resetDb } from "@/test/db";
import { cancelLesson, restoreLesson } from "./actions";
import { getLessons, getNextLesson } from "./queries";

async function setup() {
  const blaz = await makeUser("blaz", { isOwner: true });
  const marta = await makeUser("marta", { sections: ["mase", "oznanila", "dogodki"], requiresApproval: true });
  const ana = await makeUser("ana", { name: "Ana Rozman", sections: ["verouk"] });
  const groups = await db
    .insert(schema.catechesisGroups)
    .values([
      { name: "1.–3. razred", weekday: 2, time: "16:00", place: "Veroučna učilnica v župnišču", kids: 14, position: 0 },
      { name: "4.–6. razred", weekday: 3, time: "16:30", place: "Veroučna učilnica v župnišču", kids: 17, position: 1 },
      { name: "7.–9. razred, birmanci", weekday: 5, time: "17:30", place: "Mežnarija v Spodnjih Pirničah", kids: 11, position: 2 },
    ])
    .returning();
  return { blaz, marta, ana, g46: groups[1].id, g13: groups[0].id };
}

const MSG = "Zaradi jesenskih počitnic.";

describe("lesson.cancel / lesson.restore", () => {
  beforeEach(resetDb);

  it("Ana cancels: one cancellation row and one history row", async () => {
    const { ana, g46 } = await setup();
    const r = await cancelLesson(ana, { groupId: g46, date: "2026-10-28", message: MSG });
    expect(r.status).toBe("applied");
    const rows = await db.select().from(schema.catechesisCancellations);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ groupId: g46, date: "2026-10-28", message: MSG });
    const hs = await db.select().from(schema.history);
    expect(hs).toHaveLength(1);
    expect(hs[0]).toMatchObject({ section: "verouk", label: "Verouk 4.–6. razred odpade" });
  });

  it("Marta gets forbidden and nothing is written", async () => {
    const { marta, g46 } = await setup();
    await expect(cancelLesson(marta, { groupId: g46, date: "2026-10-28", message: MSG })).rejects.toThrow("forbidden");
    expect(await db.select().from(schema.catechesisCancellations)).toHaveLength(0);
    expect(await db.select().from(schema.changeRequests)).toHaveLength(0);
  });

  it("rejects a wrong weekday and a double cancel", async () => {
    const { ana, g46 } = await setup();
    await expect(cancelLesson(ana, { groupId: g46, date: "2026-10-29" })).rejects.toThrow("Ta dan te skupine ni verouka.");
    await cancelLesson(ana, { groupId: g46, date: "2026-10-28" });
    await expect(cancelLesson(ana, { groupId: g46, date: "2026-10-28" })).rejects.toThrow("Ta ura verouka že odpade.");
  });

  it("the owner restores, and getLessons reflects both states", async () => {
    const { blaz, ana, g46 } = await setup();
    await cancelLesson(ana, { groupId: g46, date: "2026-10-28", message: MSG });
    let week = await getLessons("2026-10-26");
    expect(week.map((l) => [l.name, l.date, l.time, l.cancelled])).toEqual([
      ["1.–3. razred", "2026-10-27", "16:00", false],
      ["4.–6. razred", "2026-10-28", "16:30", true],
      ["7.–9. razred, birmanci", "2026-10-30", "17:30", false],
    ]);
    expect(week[1]).toMatchObject({ message: MSG, kids: 17 });

    const r = await restoreLesson(blaz, { groupId: g46, date: "2026-10-28" });
    expect(await db.select().from(schema.catechesisCancellations)).toHaveLength(0);
    week = await getLessons("2026-10-28"); // any day of the week works
    expect(week[1]).toMatchObject({ cancelled: false, message: "" });
    const hs = await db.select().from(schema.history).orderBy(schema.history.id);
    expect(hs.at(-1)!.label).toBe("Verouk 4.–6. razred spet na urniku");
    await expect(restoreLesson(blaz, { groupId: g46, date: "2026-10-28" })).rejects.toThrow("Ta ura verouka ni odpovedana.");

    // Undo of the restore brings the cancellation back.
    await undo(blaz, (r as { historyId: number }).historyId);
    expect((await getLessons("2026-10-26"))[1]).toMatchObject({ cancelled: true, message: MSG });
  });

  it("getNextLesson skips lessons that already started (clock: Tue 10:00)", async () => {
    const { g13 } = await setup();
    const next = await getNextLesson();
    expect(next).toMatchObject({ groupId: g13, date: "2026-10-27", time: "16:00" });
  });
});
