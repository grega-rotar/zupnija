/**
 * The homepage "Danes" widget and week ahead (US-002, US-004). The pure
 * builders use the PRD's parity scenario (Wednesday 2026-10-28: 7.30 Sv. Križ,
 * 18.00 Marijina cerkev); one [db] test reads the seeded parish.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db";
import { perform } from "@/lib/admin/engine";
import { loadActor } from "@/lib/admin/actor";
import type { Actor } from "@/lib/admin/sections";
import { setNow } from "@/lib/clock";
import type { Mass, MassDay } from "@/lib/masses";
import { resetDb } from "@/test/db";
import { seedParish, type SeededParish } from "@/test/seed";
import "@/lib/mase/actions";
import {
  buildTodayBlock,
  countdownChip,
  formatCountdown,
  formatDaysUntil,
  getTodayBlock,
  massesUntilSunday,
  missingBulletinNote,
  timelinePercent,
  widgetDayLabel,
} from "./today";

const kriz = { _id: "church-sv-kriz", name: "Podružnična cerkev Povišanja svetega Križa", shortName: "Sv. Križ", slug: "sv-kriz" };
const marija = { _id: "church-marijina", name: "Župnijska cerkev Marijinega vnebovzetja", shortName: "Marijina cerkev", slug: "marijina" };

function mass(time: string, church: Mass["church"], intentions: string[] = [], extra: Partial<Mass> = {}): Mass {
  return {
    key: `${time}-${church?.slug}`,
    time,
    church,
    type: "regular",
    status: "scheduled",
    statusNote: null,
    note: null,
    celebrant: null,
    intentions: intentions.map((text, n) => ({ _key: `i${n}`, kind: null, text })),
    recurring: true,
    ...extra,
  };
}

function day(date: string, masses: Mass[], extra: Partial<MassDay> = {}): MassDay {
  return { date, liturgicalTitle: null, note: null, masses, hasExplicitDay: true, ...extra };
}

/** 2026-10-28 → 2026-11-03, as in PRD §10 (2. 11. has no Mass). */
function parity(cancelled18 = false): MassDay[] {
  return [
    day("2026-10-28", [
      mass("07:30", kriz, ["Za zdravje"]),
      mass("18:00", marija, cancelled18 ? [] : ["+ Marija Kos, 30. dan", "++ Anton in Ivana Zupan, obl."], cancelled18 ? { status: "cancelled", statusNote: "Bolezen." } : {}),
    ], { liturgicalTitle: "Sv. Simon in Juda Tadej, apostola" }),
    day("2026-10-29", [mass("18:00", marija)]),
    day("2026-10-30", [mass("18:00", marija, ["Za farane"])]),
    day("2026-10-31", [mass("18:00", marija)]),
    day("2026-11-01", [mass("08:00", kriz, ["Za farane"], { type: "sunday" }), mass("10:00", marija, ["++ Franc in Ana Kralj"], { type: "sunday" })], {
      liturgicalTitle: "Vsi sveti",
      sundayName: "Vsi sveti",
      gospel: "»Blagor žalostnim, kajti potolaženi bodo.«",
    }),
    day("2026-11-02", []),
    day("2026-11-03", [mass("18:00", marija, ["+ Jože Novak, obl."])]),
  ];
}

describe("buildTodayBlock [unit]", () => {
  it("at 14.40 on Wednesday: today, 18.00 in 200 minutes, the 7.30 Mass over", () => {
    const b = buildTodayBlock(parity(), "2026-10-28", "14:40");
    expect(b).toMatchObject({ mode: "today", headline: "Sveta maša danes ob 18.00", nextInMinutes: 200, earlierToday: ["7.30"] });
    expect(b.today.map((m) => [m.label, m.past])).toEqual([["7.30", true], ["18.00", false]]);
    expect(b.next).toMatchObject({ label: "18.00", church: "Marijina cerkev", intentions: ["+ Marija Kos, 30. dan", "++ Anton in Ivana Zupan, obl."] });
    expect(b.day.title).toBe("Sv. Simon in Juda Tadej, apostola");
    expect(countdownChip(b)).toBe("čez 3 h 20 min");
  });

  it("at 19.00 both Masses are over: tomorrow at 18.00", () => {
    const b = buildTodayBlock(parity(), "2026-10-28", "19:00");
    expect(b).toMatchObject({ mode: "tomorrow", headline: "Jutri ob 18.00", earlierToday: ["7.30", "18.00"] });
    expect(b.next).toMatchObject({ date: "2026-10-29", intentions: [] });
  });

  it("a Mass under way is still the headline, counted as now", () => {
    const b = buildTodayBlock(parity(), "2026-10-28", "18:20");
    expect(b).toMatchObject({ mode: "today", nextInMinutes: 0 });
    expect(countdownChip(b)).toBe("zdaj");
  });

  it("on 2. 11. (no Mass): none-today, next is 3. 11. at 18.00 with its intention", () => {
    const b = buildTodayBlock(parity().slice(5), "2026-11-02", "09:00");
    expect(b).toMatchObject({ mode: "none-today", headline: "Danes ni svete maše", earlierToday: [] });
    expect(b.next).toMatchObject({ date: "2026-11-03", label: "18.00", church: "Marijina cerkev", intentions: ["+ Jože Novak, obl."] });
    expect(countdownChip(b)).toBe("jutri");
  });

  it("nothing ahead: none-at-all", () => {
    const b = buildTodayBlock([day("2026-11-02", [])], "2026-11-02", "09:00");
    expect(b).toMatchObject({ mode: "none-at-all", next: null, nextInMinutes: null });
    expect(countdownChip(b)).toBeNull();
  });

  it("a cancelled Mass is listed but never the headline", () => {
    const b = buildTodayBlock(parity(true), "2026-10-28", "14:40");
    expect(b.today[1]).toMatchObject({ label: "18.00", cancelled: true, cancelReason: "Bolezen.", intentions: [] });
    expect(b).toMatchObject({ mode: "tomorrow", headline: "Jutri ob 18.00" });
    expect(b.next?.date).toBe("2026-10-29");
  });

  it("on Sunday 1. 11. both Masses, the Sunday's name and Gospel line", () => {
    const b = buildTodayBlock(parity().slice(4), "2026-11-01", "07:20");
    expect(b).toMatchObject({ mode: "today", headline: "Sveta maša danes ob 8.00", nextInMinutes: 40 });
    expect(b.following.map((m) => [m.label, m.church])).toEqual([["10.00", "Marijina cerkev"]]);
    expect(b.day).toMatchObject({ sundayName: "Vsi sveti", gospel: "»Blagor žalostnim, kajti potolaženi bodo.«" });
  });

  it("the countdown chip is hidden beyond 12 hours (a day label instead)", () => {
    const b = buildTodayBlock(parity().slice(5), "2026-11-02", "05:00");
    expect(b.nextInMinutes).toBe(13 * 60 + 24 * 60);
    expect(countdownChip(b)).toBe("jutri");
  });
});

describe("formatting [unit]", () => {
  it("formatCountdown", () => {
    expect(formatCountdown(200)).toBe("čez 3 h 20 min");
    expect(formatCountdown(45)).toBe("čez 45 min");
    expect(formatCountdown(120)).toBe("čez 2 h");
    expect(formatCountdown(0)).toBe("zdaj");
  });

  it("days until, timeline and the day label", () => {
    expect([0, 1, 4].map(formatDaysUntil)).toEqual(["danes", "jutri", "čez 4 dni"]);
    expect(timelinePercent("06:00")).toBe(0);
    expect(timelinePercent("18:00")).toBe(80);
    expect(timelinePercent("07:30")).toBe(10);
    expect(timelinePercent("22:30")).toBe(100);
    expect(widgetDayLabel("2026-10-28", "2026-10-28")).toBe("Danes · sreda, 28. oktober");
    expect(widgetDayLabel("2026-10-29", "2026-10-28")).toBe("Jutri · četrtek, 29. oktober");
    expect(widgetDayLabel("2026-11-02", "2026-10-28")).toBe("Ponedeljek, 2. november");
  });

  it("Masses until Sunday: tomorrow to the coming Sunday, named Sunday", () => {
    const week = massesUntilSunday(parity(), "2026-10-28");
    expect(week.map((d) => [d.label, d.day, d.masses.map((m) => `${m.label} ${m.church}`)])).toEqual([
      ["ČET", "29", ["18.00 Marijina"]],
      ["PET", "30", ["18.00 Marijina"]],
      ["SOB", "31", ["18.00 Marijina"]],
      ["NED · VSI SVETI", "1", ["8.00 Sv. Križ", "10.00 Marijina"]],
    ]);
    expect(week[3].sunday).toBe(true);
  });

  it("the missing month's bulletin note", () => {
    const oct = { periodStart: "2026-10-01", periodEnd: "2026-10-31" };
    expect(missingBulletinNote(oct, "2026-10-28")).toBeNull();
    expect(missingBulletinNote(oct, "2026-11-02")).toEqual({
      heading: "November 2026",
      note: "Novembrska oznanila še niso objavljena. Do takrat veljajo oktobrska.",
    });
  });
});

describe("getTodayBlock [db]", () => {
  let s: SeededParish;
  let blaz: Actor;

  beforeEach(async () => {
    await resetDb();
    s = await seedParish(db);
    blaz = (await loadActor(db, "blaz")) as Actor;
  });

  it("Tuesday 27. 10. at 10.00: today at 18.30 with the published intention", async () => {
    setNow("2026-10-27T10:00:00+01:00");
    const { block, week } = await getTodayBlock();
    expect(block).toMatchObject({ mode: "today", headline: "Sveta maša danes ob 18.30", nextInMinutes: 510 });
    expect(block.next).toMatchObject({ church: "Marijina cerkev", intentions: ["† Štefan Hrovat"] });
    expect(week.map((d) => d.date)).toEqual(["2026-10-28", "2026-10-29", "2026-10-30", "2026-10-31", "2026-11-01"]);
  });

  it("a Mass cancelled in the editor is struck and skipped", async () => {
    await perform(blaz, "mass.cancel", { massId: s.masses["2026-10-27 18:30"], reason: "Bolezen.", intentionHandling: "keep" });
    setNow("2026-10-27T10:00:00+01:00");
    const { block } = await getTodayBlock();
    expect(block.today[0]).toMatchObject({ cancelled: true, cancelReason: "Bolezen." });
    expect(block).toMatchObject({ mode: "none-today", headline: "Danes ni svete maše" });
    expect(block.next).toMatchObject({ date: "2026-10-28", label: "18.30" });
  });
});
