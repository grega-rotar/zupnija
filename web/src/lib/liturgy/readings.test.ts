/**
 * hozana's api.php readings (US-003), on hand-made fixtures in the documented
 * shape (https://hozana.si/api; we have no key yet).
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import weekday from "./__fixtures__/api_bb_2026-10-28.json";
import sunday from "./__fixtures__/api_bb_2026-11-01.json";
import { apiDate, fetchReadings, htmlToParagraphs, parseHozanaBB, readingsApiUrl, resetReadingsMemory } from "./readings";
import { getReadings, inReadingsWindow } from "./readings-data";

describe("parseHozanaBB [unit]", () => {
  it("a weekday: Berilo, Psalm, Evangelij with text as paragraphs", () => {
    const r = parseHozanaBB(weekday)!;
    expect(r.title).toBe("Sv. Simon in Juda Tadej, apostola");
    expect(r.rank).toBe("praznik");
    expect(r.readings.map((x) => [x.label, x.ref])).toEqual([
      ["Berilo", "Ef 2,19-22"],
      ["Psalm", "Ps 18,2-3.4-5"],
      ["Evangelij", "Lk 6,12-16"],
    ]);
    const [first, psalm, gospel] = r.readings;
    expect(first).toMatchObject({ title: "Apostoli so temelj Cerkve", intro: "Berilo iz pisma apostola Pavla Efežanom" });
    expect(first.text).toHaveLength(2);
    expect(first.text[1]).toMatch(/^Glavni vogelni kamen .* v Duhu\.$/);
    expect(psalm.response).toBe("Po vsej zemlji se razlega njih glas.");
    // Two stanzas, the verses kept as lines.
    expect(psalm.text).toHaveLength(2);
    expect(psalm.text[0].split("\n")).toHaveLength(4);
    expect(gospel.acclamation).toMatch(/^Tebe, Boga, hvalimo/);
    expect(gospel.text.join(" ")).not.toMatch(/<|&nbsp;/);
    expect(gospel.text[0]).toContain("postal izdajalec.");
  });

  it("a Sunday: Prvo berilo, Psalm, Drugo berilo, Evangelij", () => {
    const r = parseHozanaBB(sunday)!;
    expect(r.readings.map((x) => x.label)).toEqual(["Prvo berilo", "Psalm", "Drugo berilo", "Evangelij"]);
    expect(r.readings[1].response).toBe("To je rod tistih, ki iščejo Boga.");
    expect(r.readings[3].acclamation).toBe("Pridite k meni vsi, ki se trudite in ste obteženi, in jaz vas bom poživil, govori Gospod.");
  });

  it("tolerates errors, missing fields, numbers and plain text", () => {
    expect(parseHozanaBB({ napaka: "Neveljaven ključ" })).toBeNull();
    expect(parseHozanaBB(null)).toBeNull();
    expect(parseHozanaBB([])).toBeNull();
    expect(parseHozanaBB({ opis: "Dan brez beril" })).toBeNull();
    const r = parseHozanaBB({ opis: 12, evangelij: "Jn 1,1-5", evangelij_vsebina: "V začetku je bila Beseda.\n\nIn Beseda je bila pri Bogu." })!;
    expect(r.title).toBe("12");
    expect(r.readings).toEqual([expect.objectContaining({ label: "Evangelij", ref: "Jn 1,1-5", text: ["V začetku je bila Beseda.", "In Beseda je bila pri Bogu."] })]);
  });

  it("strips HTML to paragraphs and decodes entities", () => {
    expect(htmlToParagraphs("<p>A&nbsp;b &amp; c</p><p>d<br/>e</p>")).toEqual(["A b & c", "d\ne"]);
    expect(htmlToParagraphs("<script>x</script>&#187;Da&#171;")).toEqual(["»Da«"]);
    expect(htmlToParagraphs(undefined)).toEqual([]);
  });

  it("asks api.php with the documented parameters", () => {
    expect(apiDate("2026-11-01")).toBe("1.11.2026");
    expect(readingsApiUrl("2026-10-28", "K")).toBe("https://hozana.si/api.php?kaj=bb&datum=28.10.2026&skofija=ljubljana&kljuc=K");
  });
});

describe("fetchReadings / getReadings [unit]", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    resetReadingsMemory();
  });

  it("a second request on the same date makes 0 outbound calls", async () => {
    vi.stubEnv("HOZANA_API_KEY", "test-key");
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(weekday), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const first = await getReadings("2026-10-28", "2026-10-28");
    expect(first.available && first.readings.map((x) => x.label)).toEqual(["Berilo", "Psalm", "Evangelij"]);
    expect(String((fetchMock.mock.calls[0] as unknown[])[0])).toBe("https://hozana.si/api.php?kaj=bb&datum=28.10.2026&skofija=ljubljana&kljuc=test-key");
    await getReadings("2026-10-28", "2026-10-28");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("asks again after 24 h", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(weekday), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const t = Date.parse("2026-10-28T06:00:00Z");
    await fetchReadings("2026-10-28", { key: "k", now: t });
    await fetchReadings("2026-10-28", { key: "k", now: t + 23 * 3600_000 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await fetchReadings("2026-10-28", { key: "k", now: t + 25 * 3600_000 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("without HOZANA_API_KEY: { available: false }, no call, logged once", async () => {
    vi.stubEnv("HOZANA_API_KEY", "");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(await getReadings("2026-10-28", "2026-10-28")).toMatchObject({ available: false });
    expect(await getReadings("2026-10-29", "2026-10-28")).toMatchObject({ available: false });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it("hozana down, an error object or slower than 4 s: { available: false }, logged once, never the key", async () => {
    vi.stubEnv("HOZANA_API_KEY", "secret-key");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.stubGlobal("fetch", vi.fn(async () => new Response("", { status: 503 })));
    expect(await getReadings("2026-10-28", "2026-10-28")).toEqual({ available: false, reason: "unavailable" });
    expect(await getReadings("2026-10-28", "2026-10-28")).toEqual({ available: false, reason: "unavailable" });
    expect(warn).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(warn.mock.calls)).not.toContain("secret-key");

    resetReadingsMemory();
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ napaka: "Porabljena dnevna kvota" }), { status: 200 })));
    expect(await fetchReadings("2026-10-28", { key: "k" })).toBeNull();

    // The request carries a 4 s timeout signal; when it fires, fetch rejects.
    resetReadingsMemory();
    const timeout = vi.spyOn(AbortSignal, "timeout");
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new DOMException("The operation timed out.", "TimeoutError"))));
    expect(await fetchReadings("2026-10-28", { key: "k" })).toBeNull();
    expect(timeout).toHaveBeenCalledWith(4000);
  });

  it("only dates near today are fetched (the key has 10 requests a day)", async () => {
    vi.stubEnv("HOZANA_API_KEY", "k");
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(sunday), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    expect(inReadingsWindow("2026-11-01", "2026-10-28")).toBe(true);
    expect(inReadingsWindow("2026-10-27", "2026-10-28")).toBe(true);
    expect(inReadingsWindow("2026-10-26", "2026-10-28")).toBe(false);
    expect(inReadingsWindow("2026-11-05", "2026-10-28")).toBe(false);
    expect(await getReadings("2027-03-01", "2026-10-28")).toEqual({ available: false, reason: "link" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
