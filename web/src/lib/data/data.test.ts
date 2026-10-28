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
import { eq } from "drizzle-orm";
import { dayLines } from "@/lib/masses";
import { getBulletinByStart, getBulletinCovering, getBulletinList, getCurrentBulletin, getPublishedPdf } from "./bulletins";
import { getEvent, getEventsInRange, getHomeEvents, getPastEvents, getUpcomingEvents } from "./events";
import { getChurchMasses, getMassDays, getMassWeek, getUpcomingMasses, getWeekMasses } from "./masses";
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

  it("getChurchMasses lists one church's Masses for the next 14 days, in order, with intentions (US-011)", async () => {
    const [marija, kriz, tomaz] = await Promise.all([
      getChurchMasses("marijino-vnebovzetje", 14),
      getChurchMasses("sv-kriz", 14),
      getChurchMasses("sv-tomaz", 14),
    ]);
    const rows = (days: typeof marija) => days.flatMap((d) => d.masses.map((x) => `${d.date} ${x.time} ${x.church?.shortName}`));
    // Sv. Križ: Sunday 8.00, Monday and Friday 18.30, from Tuesday 27 Oct through Monday 9 Nov.
    expect(rows(kriz)).toEqual([
      "2026-10-30 18:30 Sv. Križ",
      "2026-11-01 08:00 Sv. Križ",
      "2026-11-02 18:30 Sv. Križ",
      "2026-11-06 18:30 Sv. Križ",
      "2026-11-08 08:00 Sv. Križ",
      "2026-11-09 18:30 Sv. Križ",
    ]);
    expect(rows(marija)).toHaveLength(10);
    expect(rows(marija).every((r) => r.endsWith("Marijina cerkev"))).toBe(true);
    expect(rows(marija)).toEqual([...rows(marija)].sort());
    const wed = marija.find((d) => d.date === "2026-10-28")!;
    expect(wed.masses[0].intentions.map((x) => x.text)).toEqual(["Branko Babnik"]);
    expect(tomaz).toEqual([]);
  });

  it("getChurchMasses leaves out today's Masses that are already over", async () => {
    // 08:00 has passed at 10:00; 19:00 is still ahead.
    await db.insert(schema.masses).values([
      { date: "2026-10-27", time: "08:00", churchId: s.churches.kriz, source: "manual" },
      { date: "2026-10-27", time: "19:00", churchId: s.churches.kriz, source: "manual" },
    ]);
    const kriz = await getChurchMasses("sv-kriz", 1);
    expect(kriz.flatMap((d) => d.masses.map((x) => `${d.date} ${x.time}`))).toEqual(["2026-10-27 19:00"]);
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
  const october = {
    periodStart: "2026-10-01",
    periodEnd: "2026-10-31",
    title: "Oktober 2026",
    issue: "Leto XLII, številka 10",
    article: { title: "Rožnovenska Mati Božja", text: "God Rožnovenske Matere Božje …\n\nIzvor praznika …" },
    prayerIntention: { title: "Za duševno zdravje", text: "Molimo za zdravstvene delavce …" },
    status: "published" as const,
  };

  it("shows published bulletins only, with their notices", async () => {
    await db.insert(schema.bulletinNotices).values([
      { bulletinId: s.bulletins.w1025, position: 1, text: "Druga" },
      { bulletinId: s.bulletins.w1025, position: 0, text: "Prva" },
    ]);
    await db.insert(schema.bulletins).values({ periodStart: "2026-11-01", periodEnd: "2026-11-30", title: "November 2026", status: "pending" });
    const cur = await getCurrentBulletin();
    expect(cur).toMatchObject({ periodStart: "2026-10-25", periodEnd: "2026-10-31", hasPdf: false, pdfUrl: null });
    expect(cur!.notices.map((n) => n.text)).toEqual(["Prva", "Druga"]);
    expect(await getBulletinByStart("2026-11-01")).toBeNull();
    expect((await getBulletinList()).map((b) => [b.periodStart, b.label, b.itemCount])).toEqual([
      ["2026-10-25", "25.–31. oktober 2026", 2],
      ["2026-10-18", "18.–24. oktober 2026", 0],
    ]);
  });

  it("the monthly bulletin covering today wins over an old weekly one; it carries article, prayer intention, events and the PDF link", async () => {
    const [up] = await db.insert(schema.uploads).values({ filename: "oznanila-oktober-2026.pdf", mime: "application/pdf", size: 3, path: "ab/x.pdf", sha256: "x" }).returning();
    const [oct] = await db.insert(schema.bulletins).values({ ...october, uploadId: up.id }).returning();
    await db.insert(schema.bulletinNotices).values({ bulletinId: oct.id, position: 0, text: "Mesec oktober je posvečen rožnemu vencu." });
    await db.insert(schema.events).values({ title: "Seja ŽPS", date: "2026-10-06", time: "19:15", place: "župnišče", sourceBulletinId: oct.id });
    const cur = (await getCurrentBulletin())!;
    expect(cur).toMatchObject({
      id: oct.id,
      title: "Oktober 2026",
      issue: "Leto XLII, številka 10",
      article: { title: "Rožnovenska Mati Božja" },
      prayerIntention: { title: "Za duševno zdravje" },
      hasPdf: true,
      pdfUrl: "/oznanila/2026-10-01/oznanila.pdf",
    });
    expect(cur.notices.map((n) => n.text)).toEqual(["Mesec oktober je posvečen rožnemu vencu."]);
    expect(cur.events.map((e) => e.title)).toEqual(["Seja ŽPS"]);
    expect((await getBulletinCovering("2026-10-07"))!.id).toBe(oct.id);
    expect((await getBulletinCovering("2026-10-26"))!.id).toBe(oct.id);
    expect((await getBulletinList())[0]).toMatchObject({ periodStart: "2026-10-25", label: "25.–31. oktober 2026" });
    expect((await getBulletinList()).find((b) => b.id === oct.id)).toMatchObject({ label: "Oktober 2026", hasPdf: true });
  });

  it("an image upload is never offered as PDF; after the period ends, the latest bulletin still shows", async () => {
    const [img] = await db.insert(schema.uploads).values({ filename: "list.jpg", mime: "image/jpeg", size: 3, path: "ab/x.jpg", sha256: "y" }).returning();
    await db.insert(schema.bulletins).values({ ...october, periodStart: "2026-09-01", periodEnd: "2026-09-30", title: "September 2026", uploadId: img.id });
    expect(await getPublishedPdf("2026-09-01")).toBeNull();
    await db.delete(schema.bulletins).where(eq(schema.bulletins.periodStart, "2026-10-25"));
    // Today (27.10.) is covered by nothing now: the latest started bulletin is 18.–24. 10.
    expect(await getCurrentBulletin()).toMatchObject({ periodStart: "2026-10-18", hasPdf: false });
  });
});

describe("calendar days", () => {
  it("mass days carry the bulletin's liturgical title, Sunday name and Gospel line", async () => {
    await db.insert(schema.calendarDays).values([
      { date: "2026-10-25", title: "30. navadna nedelja", sundayName: "30. navadna nedelja", gospel: "»Kdor se povišuje, bo ponižan.«", tags: ["15.00 – 18.30 ČEŠČENJE S.R.T."] },
      { date: "2026-10-28", title: "Simon in Juda Tadej, apostola" },
    ]);
    const days = await getWeekMasses("2026-10-27");
    expect(days[0]).toMatchObject({ liturgicalTitle: "30. navadna nedelja", sundayName: "30. navadna nedelja", gospel: "»Kdor se povišuje, bo ponižan.«", tags: ["15.00 – 18.30 ČEŠČENJE S.R.T."] });
    expect(days[3]).toMatchObject({ date: "2026-10-28", liturgicalTitle: "Simon in Juda Tadej, apostola", sundayName: null, gospel: null, tags: [] });
    expect(days[1]).toMatchObject({ liturgicalTitle: null, sundayName: null });
    // The bulletin's calendar wins over the built-in feast list; an override's label wins over both.
    await db.insert(schema.calendarDays).values({ date: "2026-11-01", title: "Vsi sveti, slovesni praznik" });
    expect((await getWeekMasses("2026-11-01"))[0].liturgicalTitle).toBe("Vsi sveti, slovesni praznik");
    await db.insert(schema.massDayOverrides).values({ date: "2026-11-01", replacesSchedule: false, label: "Vsi sveti (maše kot ob nedeljah)" });
    expect((await getWeekMasses("2026-11-01"))[0].liturgicalTitle).toBe("Vsi sveti (maše kot ob nedeljah)");
  });

  it("dayLines shows a Sunday's name only when it differs from the title", () => {
    expect(dayLines({ liturgicalTitle: "28. navadna nedelja", sundayName: "28. navadna nedelja", gospel: "»Kje pa je onih devet?«" })).toEqual({
      title: "28. navadna nedelja",
      sunday: null,
      gospel: "»Kje pa je onih devet?«",
    });
    expect(dayLines({ liturgicalTitle: "Vsi sveti", sundayName: "31. navadna nedelja", gospel: null })).toEqual({ title: "Vsi sveti", sunday: "31. navadna nedelja", gospel: null });
    expect(dayLines({ liturgicalTitle: null, sundayName: "29. navadna nedelja" })).toEqual({ title: "29. navadna nedelja", sunday: null, gospel: null });
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
