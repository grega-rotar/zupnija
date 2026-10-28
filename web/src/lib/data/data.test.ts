/**
 * The public data layer (US-014): published editor data only, in the shapes
 * the site's components use. Clock: 2026-10-27 10:00 (vitest.config.ts).
 */
import { beforeEach, describe, expect, it } from "vitest";
import { db, schema } from "@/db";
import { approve, perform } from "@/lib/admin/engine";
import { loadActor } from "@/lib/admin/actor";
import type { Actor } from "@/lib/admin/sections";
import { getWeek } from "@/lib/mase/queries";
import { resetDb } from "@/test/db";
import { seedParish, type SeededParish } from "@/test/seed";
import "@/lib/mase/actions";
import "@/lib/dogodki/actions";
import "@/lib/verouk/actions";
import { getBulletinByWeek, getBulletinList, getCurrentBulletin } from "./bulletins";
import { getEvent, getEventsInRange, getHomeEvents, getPastEvents, getUpcomingEvents } from "./events";
import { getMassDays, getMassWeek, getUpcomingMasses, getWeekMasses } from "./masses";
import { getCatechesisGroups } from "./verouk";

let s: SeededParish;
let blaz: Actor;

beforeEach(async () => {
  await resetDb();
  s = await seedParish(db);
  blaz = (await loadActor(db, "blaz")) as Actor;
});

describe("masses", () => {
  it("getWeekMasses(2026-10-27) matches the editor's week (Sunday 25 – Saturday 31): 8 masses, the 6 published intentions", async () => {
    const [days, editor] = await Promise.all([getWeekMasses("2026-10-27"), getWeek("2026-10-27")]);
    expect([days[0].date, days[6].date]).toEqual(["2026-10-25", "2026-10-31"]);
    expect(days.map((d) => d.date)).toEqual(editor.days.map((d) => d.date));
    const pub = days.flatMap((d) => d.masses.map((m) => [d.date, m.time, m.church?.shortName, m.status, m.intentions.map((i) => i.text)]));
    const ed = editor.days.flatMap((d) => d.masses.map((m) => [d.date, m.time, m.church, m.status, m.intentions.map((i) => i.text)]));
    expect(pub).toHaveLength(8);
    expect(pub).toEqual(ed);
    expect(days.flatMap((d) => d.masses.flatMap((m) => m.intentions))).toHaveLength(6);
  });

  it("maps rows into the Mass/MassDay shape the components use", async () => {
    const days = await getWeekMasses("2026-10-27");
    const wed = days.find((d) => d.date === "2026-10-28")!;
    expect(wed.hasExplicitDay).toBe(true);
    expect(wed.masses[0]).toEqual({
      key: `m${s.masses["2026-10-28 18:30"]}`,
      time: "18:30",
      church: { _id: "church-marijino-vnebovzetje", name: "Župnijska cerkev Marijinega vnebovzetja", shortName: "Marijina cerkev", slug: "marijino-vnebovzetje" },
      type: "regular",
      status: "scheduled",
      statusNote: null,
      note: null,
      celebrant: null,
      intentions: [expect.objectContaining({ kind: "deceased", text: "Branko Babnik" })],
      recurring: true,
    });
    expect((await getWeekMasses("2026-11-01"))[0].liturgicalTitle).toBe("Vsi sveti");
    expect(days.find((d) => d.date === "2026-10-31")!.masses[0]).toMatchObject({ type: "sunday", note: "nedeljska maša v soboto zvečer" });
  });

  it("never shows Marta's pending Ivana Kos intention", async () => {
    const days = await getWeekMasses("2026-11-01");
    const sun8 = days.find((d) => d.date === "2026-11-01")!.masses.find((m) => m.time === "08:00")!;
    expect(sun8.intentions).toEqual([]);
    expect(JSON.stringify(days)).not.toContain("Ivana Kos");
  });

  it("a cancelled Mass stays listed with status cancelled and its reason; its kept intention is hidden", async () => {
    await perform(blaz, "mass.cancel", { massId: s.masses["2026-10-28 18:30"], reason: "Župnik je na duhovnih vajah.", intentionHandling: "keep" });
    const wed = (await getMassDays("2026-10-28", "2026-10-28"))[0];
    expect(wed.masses).toHaveLength(1);
    expect(wed.masses[0]).toMatchObject({ status: "cancelled", statusNote: "Župnik je na duhovnih vajah.", intentions: [] });
  });

  it("a moved intention appears on the next Mass", async () => {
    await perform(blaz, "mass.cancel", { massId: s.masses["2026-10-28 18:30"], reason: "Bolezen.", intentionHandling: "next" });
    const thu = (await getMassDays("2026-10-29", "2026-10-29"))[0];
    expect(thu.masses[0].intentions.map((i) => i.text)).toEqual(["v zahvalo", "Branko Babnik"]);
  });

  it("week 2 has the scheduled Masses and no intentions", async () => {
    const days = await getWeekMasses("2026-11-04");
    expect(days[0].date).toBe("2026-11-01");
    expect(days.flatMap((d) => d.masses)).toHaveLength(8);
    expect(days.some((d) => d.hasExplicitDay)).toBe(false);
  });

  it("generates Masses from the schedule for weeks the editor hasn't opened", async () => {
    const days = await getMassDays("2026-11-09", "2026-11-15");
    expect(days.flatMap((d) => d.masses)).toHaveLength(8);
  });

  it("getMassWeek is Sunday → Saturday, getUpcomingMasses starts today", async () => {
    const w = await getMassWeek("2026-10-28");
    expect([w.from, w.to, w.days.length]).toEqual(["2026-10-25", "2026-10-31", 7]);
    const u = await getUpcomingMasses(7);
    expect([u.today, u.time, u.days.length, u.days[0].date]).toEqual(["2026-10-27", "10:00", 8, "2026-10-27"]);
  });
});

describe("events", () => {
  it("lists the 3 published events; Marta's pending event is absent", async () => {
    const list = await getUpcomingEvents();
    expect(list.map((e) => e.title)).toEqual(["Molitev za rajne na pokopališču", "Uradne ure Karitas", "Srečanje staršev birmancev"]);
    expect(JSON.stringify(list)).not.toContain("Čiščenje");
    expect(JSON.stringify(await getEventsInRange("2026-11-01", "2026-11-08"))).not.toContain("Čiščenje");
    expect(list[0]).toMatchObject({ start: "2026-11-01T14:00:00+01:00", locationName: "Pokopališče Pirniče", featured: true, summary: "Po molitvi blagoslov grobov." });
  });

  it("an approved event appears; home shows only events marked for the front page", async () => {
    expect((await getHomeEvents()).map((e) => e.title)).toEqual(["Molitev za rajne na pokopališču"]);
    await approve(blaz, s.changeRequests.ciscenje);
    expect((await getUpcomingEvents()).map((e) => e.title)).toContain("Čiščenje Marijine cerkve");
  });

  it("finds one event by slug, and lists past events", async () => {
    const [first] = await getUpcomingEvents();
    expect(first.slug).toMatch(/^molitev-za-rajne-na-pokopaliscu-\d+$/);
    const one = await getEvent(first.slug);
    expect(one).toMatchObject({ title: first.title, descriptionText: "Po molitvi blagoslov grobov." });
    expect(one!.description[0].children[0].text).toBe("Po molitvi blagoslov grobov.");
    expect(await getEvent("ni-dogodka")).toBeNull();
    await db.insert(schema.events).values({ title: "Žegnanje", date: "2026-09-14", time: "10:00", place: "Sv. Križ" });
    expect((await getPastEvents()).map((e) => e.title)).toEqual(["Žegnanje"]);
  });
});

describe("bulletins", () => {
  it("shows published bulletins only, with their notices", async () => {
    await db.insert(schema.bulletinNotices).values([
      { bulletinId: s.bulletins.w1025, position: 1, text: "Druga" },
      { bulletinId: s.bulletins.w1025, position: 0, text: "Prva" },
    ]);
    await db.insert(schema.bulletins).values({ weekStart: "2026-11-01", status: "pending" });
    const cur = await getCurrentBulletin();
    expect(cur).toMatchObject({ weekStart: "2026-10-25", weekEnd: "2026-10-31" });
    expect(cur!.notices.map((n) => n.text)).toEqual(["Prva", "Druga"]);
    expect(await getBulletinByWeek("2026-11-01")).toBeNull();
    expect((await getBulletinList()).map((b) => [b.weekStart, b.itemCount])).toEqual([
      ["2026-10-25", 2],
      ["2026-10-18", 0],
    ]);
  });
});

describe("verouk", () => {
  it("lists the 3 groups with their weekly lesson; a cancellation carries its message", async () => {
    const ana = (await loadActor(db, "ana")) as Actor;
    await perform(ana, "lesson.cancel", { groupId: s.groups.g46, date: "2026-10-28", message: "Zaradi jesenskih počitnic." });
    const groups = await getCatechesisGroups();
    expect(groups.map((g) => [g.title, g.sessions[0].weekday, g.sessions[0].time])).toEqual([
      ["1.–3. razred", "tuesday", "16:00"],
      ["4.–6. razred", "wednesday", "16:30"],
      ["7.–9. razred, birmanci", "friday", "17:30"],
    ]);
    expect(groups[1].cancellations).toEqual([{ date: "2026-10-28", message: "Zaradi jesenskih počitnic." }]);
    expect(groups[0].cancellations).toEqual([]);
  });
});
