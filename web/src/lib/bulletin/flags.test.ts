import { describe, expect, it } from "vitest";
import rokopis from "./fixtures/extract-rokopis.json";
import pdf from "./fixtures/extract-pdf.json";
import { flagScheduleMismatches } from "./flags";
import { parseReply } from "./prompt";
import { readableDraftSchema, type ReadableDraft, type WeekMass } from "./types";

/** The regular schedule of the week Sunday 2026-11-01 … Saturday 07 (src/test/seed.ts). */
const WEEK: WeekMass[] = [
  { date: "2026-11-01", time: "08:00", churchSlug: "sv-kriz" },
  { date: "2026-11-01", time: "10:00", churchSlug: "marijino-vnebovzetje" },
  { date: "2026-11-02", time: "18:30", churchSlug: "sv-kriz" },
  { date: "2026-11-03", time: "18:30", churchSlug: "marijino-vnebovzetje" },
  { date: "2026-11-04", time: "18:30", churchSlug: "marijino-vnebovzetje" },
  { date: "2026-11-05", time: "07:00", churchSlug: "marijino-vnebovzetje" },
  { date: "2026-11-06", time: "18:30", churchSlug: "sv-kriz" },
  { date: "2026-11-07", time: "18:30", churchSlug: "marijino-vnebovzetje" },
];
const draft = (d: unknown): ReadableDraft => readableDraftSchema.parse(d);

describe("flagScheduleMismatches [unit]", () => {
  it("flags Friday 17:30 against the 18:30 schedule even without a model flag", () => {
    const out = flagScheduleMismatches(draft(rokopis), WEEK);
    const fri = out.items.find((i) => i.date === "2026-11-06")!;
    expect(fri.flag).toMatchObject({ field: "time", options: ["17:30", "18:30"] });
    expect(fri.flag!.question).toBe("Na listu piše 17.30, po urniku je petkova maša ob 18.30. Kdaj bo?");
    const flagged = out.items.filter((i) => i.flag);
    expect(flagged.map((i) => [i.flag!.field, i.flag!.options])).toEqual([
      ["text", ["Jože Novak", "Jože Nosak"]],
      ["time", ["17:30", "18:30"]],
    ]);
  });

  it("leaves a draft that matches the schedule unflagged", () => {
    expect(flagScheduleMismatches(draft(pdf), WEEK).items.filter((i) => i.flag)).toHaveLength(0);
  });

  it("flags every mismatched item: time, church and date", () => {
    const base = { kind: "deceased" as const, text: "X" };
    const out = flagScheduleMismatches(
      {
        readable: true,
        weekStart: "2026-11-01",
        notices: [],
        items: [
          { id: "a", date: "2026-11-03", time: "19:00", churchSlug: "marijino-vnebovzetje", ...base },
          { id: "b", date: "2026-11-03", time: "18:30", churchSlug: "sv-kriz", ...base },
          { id: "c", date: "2026-11-02", time: "07:00", churchSlug: "sv-tomaz", ...base },
          { id: "d", date: "2026-11-09", time: "18:30", churchSlug: "sv-kriz", ...base },
          { id: "e", date: "2026-11-01", time: "10:00", churchSlug: "marijino-vnebovzetje", ...base },
        ],
      },
      WEEK,
    );
    expect(out.items.map((i) => i.flag?.field ?? null)).toEqual(["time", "church", "time", "date", null]);
    expect(out.items[1].flag!.options).toEqual(["sv-kriz", "marijino-vnebovzetje"]);
    expect(out.items[3].flag!.options).toEqual(["2026-11-09", "2026-11-02", "2026-11-06"]);
  });

  it("does not mutate its input", () => {
    const d = draft(rokopis);
    flagScheduleMismatches(d, WEEK);
    expect(d.items[6].flag).toBeUndefined();
  });
});

describe("parseReply [unit]", () => {
  it("accepts fenced JSON, nulls and dotted times", () => {
    const d = parseReply("Tukaj je:\n```json\n" + JSON.stringify({ ...rokopis, items: [{ ...rokopis.items[0], time: "7.00", flag: null, sourceLine: null }] }) + "\n```");
    expect(d).toMatchObject({ readable: true, items: [{ time: "07:00" }] });
    expect(d && d.readable && d.items[0].flag).toBeUndefined();
  });

  it("rejects prose and wrong shapes", () => {
    expect(parseReply("Ne vem.")).toBeNull();
    expect(parseReply(JSON.stringify({ readable: true, items: [] }))).toBeNull();
    expect(parseReply(JSON.stringify({ ...rokopis, items: [{ ...rokopis.items[0], kind: "mass" }] }))).toBeNull();
  });
});
