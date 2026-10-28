import { describe, expect, it } from "vitest";
import { dateRange } from "@/lib/dates";
import oktober from "./fixtures/extract-oktober-2026.json";
import rokopis from "./fixtures/extract-rokopis.json";
import pdf from "./fixtures/extract-pdf.json";
import { assignMasses } from "./assign";
import { flagScheduleMismatches } from "./flags";
import { intentionKey, normaliseIntention } from "./intentions";
import { parseReply, replyPeriod, toDraft } from "./prompt";
import {
  allIntentions,
  flaggedIntentions,
  missingPeriod,
  periodTitle,
  readableDraftSchema,
  weeksOf,
  type PeriodMass,
  type ReadableDraft,
} from "./types";

const CHURCHES = [
  { slug: "marijino-vnebovzetje", name: "Župnijska cerkev Marijinega vnebovzetja" },
  { slug: "sv-kriz", name: "Podružnična cerkev Povišanja svetega Križa" },
  { slug: "sv-tomaz", name: "Podružnična cerkev sv. Tomaža, apostola" },
];
/** The regular schedule (src/test/seed.ts): weekday → [time, church]. */
const SCHEDULE: [number[], string, string][] = [
  [[0], "08:00", "sv-kriz"],
  [[0], "10:00", "marijino-vnebovzetje"],
  [[6], "18:30", "marijino-vnebovzetje"],
  [[1, 5], "18:30", "sv-kriz"],
  [[2, 3], "18:30", "marijino-vnebovzetje"],
  [[4], "07:00", "marijino-vnebovzetje"],
];
const massesFor = (start: string, end: string, skip: string[] = []): PeriodMass[] =>
  dateRange(start, end)
    .filter((d) => !skip.includes(d))
    .flatMap((date) => {
      const wd = new Date(`${date}T12:00:00Z`).getUTCDay();
      return SCHEDULE.filter(([days]) => days.includes(wd)).map(([, time, churchSlug]) => ({ date, time, churchSlug }));
    });
const WEEK = massesFor("2026-11-01", "2026-11-07");
const OCT = massesFor("2026-10-01", "2026-10-31");
const draft = (d: unknown): ReadableDraft => readableDraftSchema.parse(d);
/** A fixture (or any reply) through the server half, like extractDraft does. */
function read(reply: unknown, masses: PeriodMass[], expected = { start: "2026-10-01", end: "2026-10-31" }) {
  const r = parseReply(JSON.stringify(reply));
  if (!r || !r.readable) throw new Error("not a readable reply");
  return toDraft(r, replyPeriod(r, expected), masses, CHURCHES)!;
}

describe("normaliseIntention [unit]", () => {
  it.each([
    ["+ Jože Novak, obl.", "Jože Novak, obl.", "deceased"],
    ["++ iz družin Juvan in Kmetič", "iz družin Juvan in Kmetič", "deceased"],
    ["+ Lucija in + Andrejka Smrtnik.", "Lucija in Andrejka Smrtnik", "deceased"],
    ["++ Jožefa in Milan Ptiček, obl. in ++ iz družin Črnuta", "Jožefa in Milan Ptiček, obl. in iz družin Črnuta", "deceased"],
    ["++ Alojzija in Franci Oletič, 30. dan", "Alojzija in Franci Oletič, 30. dan", "deceased"],
    ["† Ana Kos", "Ana Kos", "deceased"],
    ["V zahvalo", "V zahvalo", "thanksgiving"],
    ["v zahvalo za 50 let poroke", "v zahvalo za 50 let poroke", "thanksgiving"],
    ["Za farane", "Za farane", "other"],
    ["Po namenu", "Po namenu", "other"],
    ["Za zdravje", "Za zdravje", "other"],
    ["Za Božje varstvo in blagoslov", "Za Božje varstvo in blagoslov", "other"],
    ["Na čast Svetemu Duhu", "Na čast Svetemu Duhu", "other"],
  ])("%s", (line, text, kind) => {
    expect(normaliseIntention(line)).toEqual({ text, kind });
  });

  it("the notation beats the model's kind; the model decides only unmarked text", () => {
    expect(normaliseIntention("+ Za farane", "other").kind).toBe("deceased");
    expect(normaliseIntention("V zahvalo", "deceased").kind).toBe("thanksgiving");
    expect(normaliseIntention("Marija in Franc Kralj", "deceased").kind).toBe("deceased");
    expect(normaliseIntention("Marija in Franc Kralj").kind).toBe("other");
  });

  it("intentionKey ignores case, markers, spaces and punctuation", () => {
    expect(intentionKey("V zahvalo")).toBe(intentionKey("v zahvalo"));
    expect(intentionKey("++ iz družin Pretnar in Jesihar")).toBe(intentionKey("iz družin  Pretnar in Jesihar."));
    expect(intentionKey("Jože Novak")).not.toBe(intentionKey("Jože Nosak"));
  });
});

describe("assignMasses [unit]", () => {
  const day = (date: string, ...texts: string[]) => ({ date, tags: [], intentions: texts.map((text, n) => ({ id: `x${n}`, text, kind: "other" as const })) });

  it("Sunday: line 1 → 8.00 Sv. Križ, line 2 → 10.00 Marijina cerkev (time order)", () => {
    const [sun] = assignMasses([day("2026-10-11", "Za farane", "Jože Novak, obl.")], OCT, "marijino-vnebovzetje");
    expect(sun.intentions.map((i) => [i.text, i.time, i.churchSlug])).toEqual([
      ["Za farane", "08:00", "sv-kriz"],
      ["Jože Novak, obl.", "10:00", "marijino-vnebovzetje"],
    ]);
    expect(sun.intentions.some((i) => i.flag)).toBe(false);
  });

  it("extra intentions go to the day's last Mass", () => {
    const [mon] = assignMasses([day("2026-10-12", "A", "B", "C")], OCT, "marijino-vnebovzetje");
    expect(mon.intentions.map((i) => i.time)).toEqual(["18:30", "18:30", "18:30"]);
    const [sun] = assignMasses([day("2026-10-18", "A", "B", "C")], OCT, "marijino-vnebovzetje");
    expect(sun.intentions.map((i) => i.time)).toEqual(["08:00", "10:00", "10:00"]);
  });

  it("a day without a scheduled Mass (a feast override) flags each intention with the usual times", () => {
    const masses = massesFor("2026-10-01", "2026-10-31", ["2026-10-15"]);
    const [thu] = assignMasses([day("2026-10-15", "Matija Perger")], masses, "marijino-vnebovzetje");
    expect(thu.intentions[0]).toMatchObject({ time: "07:00", churchSlug: "marijino-vnebovzetje", flag: { field: "time", options: ["07:00"] } });
    expect(thu.intentions[0].flag!.question).toContain("Ta dan po urniku ni maše");
  });

  it("keeps a printed time: a match goes to that Mass, a mismatch is flagged, not overwritten", () => {
    const d = { date: "2026-11-06", tags: [], intentions: [{ id: "a", text: "X", kind: "other" as const, time: "17:30", churchSlug: "sv-kriz" }] };
    const assigned = assignMasses([d], WEEK, "marijino-vnebovzetje");
    expect(assigned[0].intentions[0]).toMatchObject({ time: "17:30", churchSlug: "sv-kriz" });
    const flagged = flagScheduleMismatches(draft({ readable: true, period: { start: "2026-11-01", end: "2026-11-07", title: "T" }, days: assigned, notices: [], events: [] }), WEEK);
    expect(flagged.days[0].intentions[0]).toMatchObject({ time: "17:30", flag: { field: "time", options: ["17:30", "18:30"] } });
  });
});

describe("flagScheduleMismatches [unit]", () => {
  it("the handwritten weekly sheet: Friday 17:30 is flagged against 18:30, the illegible name keeps its flag", () => {
    const out = read(rokopis, WEEK, { start: "2026-11-01", end: "2026-11-07" });
    const fri = out.days.find((d) => d.date === "2026-11-06")!.intentions[0];
    expect(fri.flag).toMatchObject({ field: "time", options: ["17:30", "18:30"] });
    expect(fri.flag!.question).toBe("Na listu piše 17.30, po urniku je petkova maša ob 18.30. Kdaj bo?");
    expect(flaggedIntentions(out).map((i) => [i.flag!.field, i.flag!.options])).toEqual([
      ["text", ["Jože Novak", "Jože Nosak"]],
      ["time", ["17:30", "18:30"]],
    ]);
  });

  it("leaves a draft that matches the schedule unflagged (the weekly typed sheet)", () => {
    expect(flaggedIntentions(read(pdf, WEEK, { start: "2026-11-01", end: "2026-11-07" }))).toHaveLength(0);
  });

  it("flags time and church mismatches; a day with no Mass asks for the time", () => {
    const base = { kind: "deceased" as const, text: "X" };
    const out = flagScheduleMismatches(
      draft({
        readable: true,
        period: { start: "2026-11-01", end: "2026-11-07", title: "T" },
        notices: [],
        events: [],
        days: [
          { date: "2026-11-01", tags: [], intentions: [{ id: "e", time: "10:00", churchSlug: "marijino-vnebovzetje", ...base }] },
          { date: "2026-11-02", tags: [], intentions: [{ id: "c", time: "07:00", churchSlug: "sv-tomaz", ...base }] },
          {
            date: "2026-11-03",
            tags: [],
            intentions: [
              { id: "a", time: "19:00", churchSlug: "marijino-vnebovzetje", ...base },
              { id: "b", time: "18:30", churchSlug: "sv-kriz", ...base },
            ],
          },
          { date: "2026-11-09", tags: [], intentions: [{ id: "d", time: "18:30", churchSlug: "sv-kriz", ...base }] },
        ],
      }),
      WEEK,
    );
    expect(allIntentions(out).map((i) => [i.id, i.flag?.field ?? null])).toEqual([
      ["e", null],
      ["c", "time"],
      ["a", "time"],
      ["b", "church"],
      ["d", "time"],
    ]);
    expect(allIntentions(out)[3].flag!.options).toEqual(["sv-kriz", "marijino-vnebovzetje"]);
    expect(allIntentions(out)[4].flag!.options).toEqual(["18:30"]); // Mondays usually 18.30
  });
});

describe("the October 2026 booklet (fixture from the real PDF) [unit]", () => {
  const d = read(oktober, OCT);

  it("is a valid draft: 31 days, 35 intentions, every Sunday in time order, no flags", () => {
    expect(d.period).toEqual({ start: "2026-10-01", end: "2026-10-31", title: "Oktober 2026", issue: "Leto XLII, številka 10" });
    expect(d.days).toHaveLength(31);
    expect(allIntentions(d)).toHaveLength(35);
    expect(flaggedIntentions(d)).toHaveLength(0);
    for (const sunday of ["2026-10-04", "2026-10-11", "2026-10-18", "2026-10-25"]) {
      expect(d.days.find((x) => x.date === sunday)!.intentions.map((i) => `${i.time} ${i.churchSlug}`)).toEqual(["08:00 sv-kriz", "10:00 marijino-vnebovzetje"]);
    }
    expect(d.days.find((x) => x.date === "2026-10-11")!.intentions.map((i) => i.text)).toEqual(["Za farane", "Jože Novak, obl."]);
    expect(d.days.find((x) => x.date === "2026-10-11")).toMatchObject({ sundayName: "28. navadna nedelja", gospel: "»Kje pa je onih devet?«" });
    expect(d.days.find((x) => x.date === "2026-10-28")).toMatchObject({ title: "Simon in Juda Tadej, apostola", intentions: [{ text: "Branko Babnik", kind: "deceased", time: "18:30" }] });
    expect(d.days.find((x) => x.date === "2026-10-09")!.intentions[0].text).toBe("Alojzija in Franci Oletič, 30. dan");
    expect(d.days.find((x) => x.date === "2026-10-22")!.intentions[0].kind).toBe("thanksgiving");
  });

  it("has the meetings, the article and the prayer intention", () => {
    expect(d.events.map((e) => [e.date, e.time])).toEqual([
      ["2026-10-06", "19:15"],
      ["2026-10-14", "20:15"],
      ["2026-10-17", "18:30"],
      ["2026-10-20", "19:15"],
      ["2026-10-21", "20:00"],
      ["2026-10-24", "07:00"],
      ["2026-10-25", "15:00"],
    ]);
    expect(d.events.every((e) => e.include && !e.flag)).toBe(true);
    expect(d.article?.title).toBe("Rožnovenska Mati Božja");
    expect(d.prayerIntention?.title).toBe("Za duševno zdravje");
    expect(d.notices).toHaveLength(10);
  });

  it("reading the draft again changes nothing (a stored draft is a valid reply)", () => {
    expect(read(d, OCT)).toEqual(d);
  });

  it("weeksOf groups the month into Sunday-start weeks", () => {
    expect(weeksOf(d.days).map((w) => [w.start, w.days.length])).toEqual([
      ["2026-09-27", 3],
      ["2026-10-04", 7],
      ["2026-10-11", 7],
      ["2026-10-18", 7],
      ["2026-10-25", 7],
    ]);
  });
});

describe("other and changing formats never fail the read [unit]", () => {
  it("a day outside the period is kept with a date flag; malformed entries become notices", () => {
    const reply = {
      readable: true,
      period: { start: "2026-10-01", end: "2026-10-31", title: "Oktober 2026" },
      days: [
        { date: "2026-10-30", title: "Marcel, mučenec", intentions: ["Na čast Svetemu Duhu"] },
        { date: "2026-11-01", title: "Vsi sveti", intentions: [{ text: "Za farane" }, { kind: "other" }] },
        { date: "31. 10.", intentions: ["+ Ana Kos"] },
      ],
      notices: [{ text: "Obvestilo." }],
      events: [{ title: "Seja", date: "jutri", time: "19.15" }, { title: "Romanje", date: "2026-10-24" }],
    };
    const d = read(reply, massesFor("2026-10-01", "2026-11-01"));
    expect(d.days.map((x) => x.date)).toEqual(["2026-10-30", "2026-11-01"]);
    expect(d.days[1].intentions[0]).toMatchObject({ text: "Za farane", flag: { field: "date", options: ["2026-11-01"] } });
    expect(d.notices.map((n) => n.text)).toEqual(["Obvestilo.", "Ni razvrščeno: 31. 10. · + Ana Kos", "Ni razvrščeno: jutri · 19.15 · Seja"]);
    expect(d.events).toEqual([expect.objectContaining({ title: "Romanje", include: true, flag: expect.objectContaining({ field: "time" }) })]);
  });

  it("a week without a printed period takes its period from the listed days", () => {
    const r = parseReply(JSON.stringify({ readable: true, days: [{ date: "2026-11-02", intentions: [] }, { date: "2026-11-07", intentions: [] }] }));
    expect(r && r.readable && replyPeriod(r, { start: "2026-12-01", end: "2026-12-31" })).toEqual({ start: "2026-11-02", end: "2026-11-07", title: "2.–7. november 2026" });
  });

  it("periodTitle: a whole month or a span", () => {
    expect(periodTitle("2026-10-01", "2026-10-31")).toBe("Oktober 2026");
    expect(periodTitle("2026-10-25", "2026-10-31")).toBe("25.–31. oktober 2026");
  });
});

describe("parseReply [unit]", () => {
  it("accepts fenced JSON, nulls, strings for intentions and dotted times", () => {
    const r = parseReply(
      "Tukaj je:\n```json\n" +
        JSON.stringify({ readable: true, period: null, days: [{ date: "2026-11-05", title: null, intentions: [{ text: "Za zdravje", time: "7.00", flag: null }, "+ Ana"] }], notices: null }) +
        "\n```",
    );
    expect(r && r.readable).toBe(true);
    const d = r && r.readable ? toDraft(r, replyPeriod(r, { start: "2026-11-01", end: "2026-11-07" }), WEEK, CHURCHES) : null;
    expect(d!.days[0].intentions.map((i) => [i.text, i.kind, i.time])).toEqual([
      ["Za zdravje", "other", "07:00"],
      ["Ana", "deceased", "07:00"],
    ]);
  });

  it("rejects prose and replies without readable", () => {
    expect(parseReply("Ne vem.")).toBeNull();
    expect(parseReply(JSON.stringify({ days: [] }))).toBeNull();
    expect(parseReply(JSON.stringify({ readable: false, reason: "blurry" }))).toEqual({ readable: false, reason: "blurry" });
  });
});

describe("missingPeriod [unit]", () => {
  const pub = (periodStart: string, periodEnd: string, status = "published") => ({ periodStart, periodEnd, status });

  it("after weekly bulletins up to 31. 10., the next is November, due from 20. 10.", () => {
    const weeks = [pub("2026-10-18", "2026-10-24"), pub("2026-10-25", "2026-10-31")];
    expect(missingPeriod("2026-10-27", weeks)).toEqual({ start: "2026-11-01", end: "2026-11-30", title: "November 2026", due: true });
    expect(missingPeriod("2026-10-19", [pub("2026-10-01", "2026-10-31")])).toMatchObject({ start: "2026-11-01", due: false });
    expect(missingPeriod("2026-10-20", [pub("2026-10-01", "2026-10-31")])).toMatchObject({ start: "2026-11-01", due: true });
  });

  it("the current month without a bulletin is always due; pending counts, drafts don't", () => {
    expect(missingPeriod("2026-10-05", [])).toEqual({ start: "2026-10-01", end: "2026-10-31", title: "Oktober 2026", due: true });
    expect(missingPeriod("2026-10-05", [pub("2026-10-01", "2026-10-31", "pending")])).toMatchObject({ start: "2026-11-01", due: false });
    expect(missingPeriod("2026-10-05", [pub("2026-10-01", "2026-10-31", "draft")])).toMatchObject({ start: "2026-10-01", due: true });
  });

  it("follows whatever period was published last: a week after a week, the rest of a month after an odd span", () => {
    expect(missingPeriod("2026-11-12", [pub("2026-11-08", "2026-11-14")])).toEqual({ start: "2026-11-15", end: "2026-11-21", title: "15.–21. november 2026", due: true });
    expect(missingPeriod("2026-11-20", [pub("2026-11-01", "2026-11-14")])).toMatchObject({ start: "2026-11-15", end: "2026-11-30", due: true });
    expect(missingPeriod("2026-11-02", [pub("2026-11-01", "2026-11-14")])).toMatchObject({ start: "2026-11-15", due: false });
    expect(missingPeriod("2026-12-03", [pub("2026-11-01", "2026-11-30")])).toMatchObject({ start: "2026-12-01", due: true });
  });
});
