import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db";
import { perform } from "@/lib/admin/engine";
import { loadActor } from "@/lib/admin/actor";
import type { Actor } from "@/lib/admin/sections";
import { resetDb } from "@/test/db";
import { seedParish, type SeededParish } from "@/test/seed";
import "./actions";
import { getMass, getMassesWithoutIntention, getNextMass, getUpcomingMasses, getWeek } from "./queries";

let s: SeededParish;

describe("mase loaders (US-004, US-005)", () => {
  beforeEach(async () => {
    await resetDb();
    s = await seedParish(db);
  });

  it("week 26. okt: 8 masses in 7 days, Vsi sveti, Ivana Kos pending by Marta", async () => {
    const w = await getWeek("2026-10-26");
    expect(w.days).toHaveLength(7);
    expect(w.counts.masses).toBe(8);
    expect(w.days.flatMap((d) => d.masses)).toHaveLength(8);
    expect(w.days[6]).toMatchObject({ date: "2026-11-01", weekday: "nedelja", label: "nedelja, 1. november", feast: "Vsi sveti" });
    expect(w.isEmpty).toBe(false);
    expect(w.counts).toMatchObject({ intentions: 6, pending: 1, withoutIntention: 1 });
    const sun8 = w.days[6].masses.find((m) => m.time === "08:00")!;
    expect(sun8.church).toBe("Sv. Križ");
    expect(sun8.intentions).toHaveLength(0);
    expect(sun8.pending.map((p) => [p.text, p.kind, p.createdByName])).toEqual([["Ivana Kos", "deceased", "Marta Zupan"]]);
    const wed = w.days[2].masses[0];
    expect([wed.time, wed.church, wed.intentions[0].text]).toEqual(["18:30", "Marijina cerkev", "Branko Babnik"]);
  });

  it("week 2. nov: 8 masses, no intentions, isEmpty", async () => {
    const w = await getWeek("2026-11-02");
    expect(w.counts.masses).toBe(8);
    expect(w.counts.intentions + w.counts.pending).toBe(0);
    expect(w.isEmpty).toBe(true);
    expect(w.days[0].feast).toBe("Spomin vseh vernih rajnih");
  });

  it("next mass is today 18.30 with Štefan Hrovat", async () => {
    const m = await getNextMass();
    expect(m).toMatchObject({ date: "2026-10-27", time: "18:30", church: "Marijina cerkev" });
    expect(m!.intentions.map((i) => i.text)).toEqual(["Štefan Hrovat"]);
  });

  it("masses without intention: only Sunday 10.00 (a pending intention counts)", async () => {
    const list = await getMassesWithoutIntention("2026-10-26");
    expect(list.map((m) => `${m.date} ${m.time}`)).toEqual(["2026-11-01 10:00"]);
  });

  it("shows a pending cancel and a cancelled mass", async () => {
    const marta = (await loadActor(db, "marta")) as Actor;
    const blaz = (await loadActor(db, "blaz")) as Actor;
    await perform(marta, "mass.cancel", { massId: s.masses["2026-10-30 18:30"], reason: "Bolezen.", intentionHandling: "keep" });
    await perform(blaz, "mass.cancel", { massId: s.masses["2026-10-28 18:30"], reason: "Duhovne vaje.", intentionHandling: "next" });
    const fri = await getMass(s.masses["2026-10-30 18:30"]);
    expect(fri!.pendingCancel).toMatchObject({ reason: "Bolezen.", intentionHandling: "keep", createdByName: "Marta Zupan" });
    const w = await getWeek("2026-10-28");
    const wed = w.days[2].masses[0];
    expect([wed.status, wed.cancelReason, wed.intentions.length]).toEqual(["cancelled", "Duhovne vaje.", 0]);
    expect(w.days[3].masses[0].intentions.map((i) => [i.text, i.movedFromMassId])).toEqual([
      ["v zahvalo", null],
      ["Branko Babnik", wed.id],
    ]);
    expect(w.counts.cancelled).toBe(1);
  });

  it("upcoming masses start after now and skip cancelled ones", async () => {
    const list = await getUpcomingMasses(5);
    expect(list.map((m) => `${m.date} ${m.time}`)).toEqual([
      "2026-10-27 18:30",
      "2026-10-28 18:30",
      "2026-10-29 07:00",
      "2026-10-30 18:30",
      "2026-10-31 18:30",
    ]);
    expect(list[0].label).toBe("torek, 27. oktober");
  });
});
