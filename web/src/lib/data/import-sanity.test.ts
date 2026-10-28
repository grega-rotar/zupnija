/**
 * The Sanity → Postgres import (scripts/import-sanity.mjs): the mapping as pure functions, and
 * importSanity against the test database with documents shaped like the production dataset.
 */
import postgres from "postgres";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { resetDb } from "@/test/db";
import { setNow } from "@/lib/clock";
import { getCurrentBulletin } from "./bulletins";
import { getEvent, getHomeEvents } from "./events";
import { getMassWeek } from "./masses";
import { getCatechesisGroups } from "./verouk";
import {
  GROUP_FALLBACK,
  importSanity,
  ljubljana,
  lossTracker,
  mapBulletin,
  mapEvent,
  mapGroup,
  mapMassDay,
  mapScheduleEntries,
  ptToText,
  tableCounts,
} from "../../../scripts/import-sanity-lib.mjs";

const block = (text: string, extra: Record<string, unknown> = {}) => ({
  _type: "block",
  style: "normal",
  markDefs: [],
  children: [{ _type: "span", marks: [], text }],
  ...extra,
});
const ref = (id: string) => ({ _type: "reference", _ref: id });

describe("ptToText", () => {
  it("one paragraph per block, list markers, images skipped and counted", () => {
    const value = [
      block("Prvi odstavek."),
      { _type: "imageWithAlt", asset: ref("image-1") },
      { ...block(""), children: [{ _type: "span", text: "Krepko" }, { _type: "span", text: " in navadno." }] },
      block("ena", { listItem: "bullet" }),
      block("prva", { listItem: "number" }),
      block("druga", { listItem: "number" }),
      block("   "),
    ];
    expect(ptToText(value)).toEqual({ text: "Prvi odstavek.\n\nKrepko in navadno.\n\n– ena\n\n1. prva\n\n2. druga", skipped: 1 });
  });

  it("empty and plain values", () => {
    expect(ptToText(undefined)).toEqual({ text: "", skipped: 0 });
    expect(ptToText(" besedilo ")).toEqual({ text: "besedilo", skipped: 0 });
  });
});

describe("mapping", () => {
  it("ljubljana: UTC datetimes to local wall clock, summer and winter", () => {
    expect(ljubljana("2026-10-17T16:30:00.000Z")).toEqual({ date: "2026-10-17", time: "18:30" });
    expect(ljubljana("2026-11-25T19:00:00.000Z")).toEqual({ date: "2026-11-25", time: "20:00" });
    expect(ljubljana("2026-12-31T23:30:00Z")).toEqual({ date: "2027-01-01", time: "00:30" });
  });

  it("mapEvent: place as on the old card, summary + description, front page from today on, losses listed", () => {
    const lost = lossTracker();
    const churches = new Map([["church-a", "Marijina cerkev"]]);
    const doc = {
      _id: "event-x",
      title: "Srečanje",
      start: "2026-11-03T18:15:00.000Z",
      end: "2026-11-03T20:00:00.000Z",
      church: ref("church-a"),
      category: "meeting",
      summary: "Kratko.",
      description: [block("Prvi."), block("Drugi.")],
      image: { asset: ref("image-1") },
      slug: { current: "srecanje" },
    };
    expect(mapEvent(doc, churches, "2026-10-28", lost)).toEqual({
      title: "Srečanje",
      date: "2026-11-03",
      time: "19:15",
      place: "Marijina cerkev",
      description: "Kratko.\n\nPrvi.\n\nDrugi.",
      onFrontPage: true,
      legacySlug: "srecanje",
    });
    expect(lost.list().map((l) => l.label)).toEqual([
      "event image",
      "event category (label on the card)",
      "event end time / multi-day span",
    ]);

    const past = mapEvent({ _id: "e2", title: "Žegnanje", start: "2026-09-20T06:00:00.000Z", allDay: true, locationName: "Sv. Križ" }, churches, "2026-10-28", lost);
    expect(past).toMatchObject({ place: "Sv. Križ", time: "08:00", description: "", onFrontPage: false });
  });

  it("mapMassDay: schedule Masses keep source and note like ensureMasses; others are manual; kinds and statuses fit the enum", () => {
    const lost = lossTracker();
    const entries = mapScheduleEntries(
      { _id: "s", entries: [{ weekdays: ["saturday"], time: "18:30", church: ref("c1"), type: "sunday", note: "v soboto zvečer" }] },
      lost,
    );
    expect(entries).toEqual([{ weekdays: [6], time: "18:30", churchRef: "c1", type: "sunday", note: "v soboto zvečer", validFrom: null, validUntil: null }]);

    const { override, masses } = mapMassDay(
      {
        _id: "massday-2026-10-31",
        date: "2026-10-31",
        liturgicalTitle: "Dan reformacije",
        masses: [
          { time: "18:30", church: ref("c1"), type: "sunday", intentions: [{ kind: "deceased", text: "Janez" }, { kind: "health", text: "za zdravje" }] },
          { time: "8:00", church: ref("c1"), type: "feast", status: "cancelled", statusNote: "Bolezen" },
          { time: "10:00", church: ref("c1"), status: "changed", statusNote: "ob 10.30" },
        ],
      },
      entries,
      lost,
    );
    expect(override).toEqual({ date: "2026-10-31", replacesSchedule: false, label: "Dan reformacije" });
    expect(masses[0]).toMatchObject({ time: "18:30", source: "schedule", type: "sunday", note: "v soboto zvečer" });
    expect(masses[0].intentions).toEqual([
      { kind: "deceased", text: "Janez" },
      { kind: "other", text: "za zdravje" },
    ]);
    expect(masses[1]).toMatchObject({ time: "08:00", source: "manual", type: "regular", status: "cancelled", cancelReason: "Bolezen" });
    expect(masses[2]).toMatchObject({ status: "scheduled", note: "ob 10.30" });
  });

  it("mapGroup: the first session; a group without one gets the visible fallback and a warning", () => {
    const lost = lossTracker();
    const warnings: string[] = [];
    const g = mapGroup(
      { _id: "g1", title: "1. razred", grade: 1, catechist: ref("p"), sessions: [{ weekday: "wednesday", time: "17:00", location: "Župnišče" }] },
      0,
      lost,
      warnings,
    );
    expect(g).toEqual({ name: "1. razred", weekday: 3, time: "17:00", place: "Župnišče", kids: 0, position: 1 });
    expect(mapGroup({ _id: "g2", title: "9. razred" }, 8, lost, warnings)).toEqual({
      name: "9. razred",
      weekday: GROUP_FALLBACK.weekday,
      time: GROUP_FALLBACK.time,
      place: GROUP_FALLBACK.place,
      kids: 0,
      position: 9,
    });
    expect(warnings).toHaveLength(1);
    expect(lost.list()).toEqual([{ label: "Verouk catechist name", count: 1, ids: ["g1"] }]);
  });

  it("mapBulletin: title and body as two paragraphs; weekStart snapped to Sunday", () => {
    const lost = lossTracker();
    const warnings: string[] = [];
    const b = mapBulletin(
      { _id: "b", weekStart: "2026-10-27", items: [{ title: "Adoracija", body: [block("Vsak dan.")] }, { title: "", body: [] }], attachments: [{}] },
      lost,
      warnings,
    );
    expect(b).toMatchObject({ weekStart: "2026-10-25", notices: ["Adoracija\n\nVsak dan."] });
    expect(warnings).toHaveLength(1);
    expect(lost.list().map((l) => l.label)).toEqual(["bulletin PDF/attachments"]);
  });
});

// Shaped like the production dataset (2026-10-28), trimmed.
const DOCS = {
  churches: [
    { _id: "church-marijino-vnebovzetje", name: "Župnijska cerkev Marijinega vnebovzetja", shortName: "Marijina cerkev", slug: "marijino-vnebovzetje", order: 1 },
    { _id: "church-sv-kriz", name: "Podružnična cerkev Povišanja svetega Križa", shortName: "Sv. Križ", slug: "sv-kriz", order: 2 },
  ],
  schedules: [
    {
      _id: "schedule-redni",
      entries: [
        { weekdays: ["sunday"], time: "08:00", church: ref("church-sv-kriz"), type: "sunday" },
        { weekdays: ["sunday"], time: "10:00", church: ref("church-marijino-vnebovzetje"), type: "sunday" },
        { weekdays: ["monday", "friday"], time: "18:30", church: ref("church-sv-kriz"), type: "regular" },
        { weekdays: ["tuesday", "wednesday"], time: "18:30", church: ref("church-marijino-vnebovzetje"), type: "regular" },
      ],
    },
  ],
  massDays: [
    { _id: "massday-2026-10-26", date: "2026-10-26", masses: [{ time: "18:30", church: ref("church-sv-kriz"), type: "regular", intentions: [{ kind: "deceased", text: "iz družin Pretnar in Jesihar" }] }] },
    { _id: "massday-2026-10-28", date: "2026-10-28", masses: [{ time: "18:30", church: ref("church-marijino-vnebovzetje"), type: "regular", intentions: [{ kind: "deceased", text: "Branko Babnik" }] }] },
  ],
  events: [
    { _id: "event-cescenje-2026", title: "Češčenje Svetega Rešnjega Telesa", start: "2026-10-25T14:00:00.000Z", church: ref("church-sv-kriz"), summary: "Češčenje med 15.00 in 18.30." },
    { _id: "event-seja-zps-2026-11", title: "Seja župnijskega pastoralnega sveta", start: "2026-11-03T18:15:00.000Z", locationName: "Župnišče", summary: "Redna mesečna seja ŽPS." },
  ],
  groups: [{ _id: "catgroup-1", title: "1. razred", grade: 1, sessions: [{ weekday: "wednesday", time: "17:00", location: "Župnišče" }] }],
  bulletins: [{ _id: "bulletin-2026-10-25", weekStart: "2026-10-25", items: [{ title: "Adoracija", body: [block("Vsak dan razen četrtka.")] }] }],
};

describe("importSanity", () => {
  const sql = postgres(process.env.DATABASE_URL!, { max: 1, onnotice: () => {} });
  afterAll(() => sql.end());
  beforeEach(async () => {
    await resetDb();
    setNow("2026-10-27T10:00:00+01:00");
  });

  it("imports what the public pages read, and a second run changes nothing", async () => {
    const first = await importSanity(sql, DOCS, { today: "2026-10-27" });
    expect(first.created).toEqual({
      churches: 2,
      mass_schedule_entries: 4,
      mass_day_overrides: 0,
      masses: 2,
      intentions: 2,
      events: 2,
      catechesis_groups: 1,
      bulletins: 1,
      bulletin_notices: 1,
    });
    const snapshot = async () => sql`select (select json_agg(t order by id) from masses t) m, (select json_agg(t order by id) from intentions t) i, (select json_agg(t order by id) from events t) e`;
    const before = await snapshot();
    const counts = await tableCounts(sql);

    const second = await importSanity(sql, DOCS, { today: "2026-10-27" });
    expect(Object.values(second.created).every((n) => n === 0)).toBe(true);
    expect(await tableCounts(sql)).toEqual(counts);
    expect(await snapshot()).toEqual(before);

    const week = await getMassWeek("2026-10-27");
    const monday = week.days.find((d) => d.date === "2026-10-26")!;
    expect(monday.masses.map((m) => [m.time, m.church?.shortName, m.recurring, m.intentions.map((i) => i.text)])).toEqual([
      ["18:30", "Sv. Križ", true, ["iz družin Pretnar in Jesihar"]],
    ]);
    expect((await getHomeEvents()).map((e) => [e.title, e.locationName, e.start])).toEqual([
      ["Seja župnijskega pastoralnega sveta", "Župnišče", "2026-11-03T19:15:00+01:00"],
    ]);
    expect((await getEvent("x-1"))?.locationName).toBe("Sv. Križ");
    expect((await getCatechesisGroups()).map((g) => [g.title, g.sessions[0].weekday, g.sessions[0].time])).toEqual([["1. razred", "wednesday", "17:00"]]);
    expect((await getCurrentBulletin())?.notices.map((n) => n.text)).toEqual(["Adoracija\n\nVsak dan razen četrtka."]);
  });

  it("refuses once the editor has history, unless forced; forced adds only what's missing", async () => {
    await importSanity(sql, DOCS, { today: "2026-10-27" });
    await sql`insert into history (section, action, label, changes) values ('mase', 'test', 'test', '[]'::jsonb)`;
    await expect(importSanity(sql, DOCS, { today: "2026-10-27" })).rejects.toMatchObject({ code: "HAS_HISTORY" });
    const forced = await importSanity(sql, DOCS, { today: "2026-10-27", force: true });
    expect(Object.values(forced.created).every((n) => n === 0)).toBe(true);
  });

  it("dry run rolls back", async () => {
    const r = await importSanity(sql, DOCS, { today: "2026-10-27", dryRun: true });
    expect(r.created.events).toBe(2);
    expect((await tableCounts(sql)).events).toBe(0);
  });
});
