/**
 * Group search filter (US-012), on the 7 imported groups plus 2 more, the
 * 9 the PRD seeds. (Named .test.ts: vitest runs only *.test.ts.)
 */
import { describe, expect, it } from "vitest";
import exportFixture from "@/test/fixtures/sanity-export.json";
import { filterByQuery, fold, groupSearchText, queryParam } from "./groupSearch";

type G = { _type: string; title: string; summary?: string | null; meetingSchedule?: string | null; location?: string | null };
const imported = (exportFixture as unknown as { documents: G[] }).documents.filter((d) => d._type === "parishGroup");
const groups: G[] = [
  ...imported,
  { _type: "parishGroup", title: "Otroški pevski zbor", summary: "Otroci pojejo pri družinski maši.", meetingSchedule: "Petek ob 17.00", location: "Župnišče" },
  { _type: "parishGroup", title: "Ministranti", summary: "Strežejo pri sveti maši.", meetingSchedule: "Sobota ob 10.00", location: "Marijina cerkev" },
];
const rows = groups.map((g) => ({ title: g.title, text: groupSearchText(g) }));
const titles = (q: string) => filterByQuery(rows, q).map((r) => r.title);

describe("group search [unit]", () => {
  it("seeds 9 groups", () => {
    expect(rows).toHaveLength(9);
  });

  it("'zbor' leaves exactly the 2 choirs", () => {
    expect(titles("zbor")).toEqual(["Odrasli pevski zbor", "Otroški pevski zbor"]);
  });

  it("'xyz' finds nothing; an empty or blank query shows all 9", () => {
    expect(titles("xyz")).toEqual([]);
    expect(titles("")).toHaveLength(9);
    expect(titles("   ")).toHaveLength(9);
  });

  it("ignores case and diacritics, and every word must match", () => {
    expect(titles("ZBOR")).toHaveLength(2);
    expect(titles("otroski")).toEqual(["Otroški pevski zbor"]);
    expect(titles("zupnisce zakonska")).toEqual(["Prva zakonska skupina", "Druga zakonska skupina"]);
    expect(fold("Češčenje Ž")).toBe("cescenje z");
  });

  it("searches the meeting time and place too", () => {
    expect(titles("sredo")).toEqual(expect.arrayContaining(["Molitvena skupina"]));
    expect(titles("mežnarija")).toEqual(["Župnijska Karitas Pirniče"]);
  });

  it("reads ?q= as one trimmed value", () => {
    expect(queryParam(" zbor ")).toBe("zbor");
    expect(queryParam(["zbor", "x"])).toBe("zbor");
    expect(queryParam(undefined)).toBe("");
    expect(queryParam("a".repeat(200))).toHaveLength(80);
  });
});
