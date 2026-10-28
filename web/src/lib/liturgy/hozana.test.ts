/** hozana.si's free day file (US-003), on a small saved fixture of osnovni_podatki.json. */
import { afterEach, describe, expect, it, vi } from "vitest";
import fixture from "./__fixtures__/osnovni_podatki.json";
import { fetchHozanaDay, hozanaUrl, parseOsnovniPodatki, resetHozanaMemory } from "./hozana";

describe("parseOsnovniPodatki [unit]", () => {
  it("a feast: title, rank and the Gospel line", () => {
    expect(parseOsnovniPodatki(fixture, "2026-10-28", "ljubljana")).toEqual({
      title: "Sv. Simon in Juda Tadej, apostola",
      rank: "praznik",
      gospelLine: "»Poklical je k sebi svoje učence in si jih je izmed njih izbral dvanajst, katere je imenoval tudi apostole.« (Lk 6,13)",
    });
  });

  it("an ordinary weekday has no rank", () => {
    expect(parseOsnovniPodatki(fixture, "2026-10-27", "ljubljana")).toMatchObject({ title: "Torek 30. tedna med letom", rank: null });
  });

  it("a weekday with an obligatory memorial shows the saint", () => {
    expect(parseOsnovniPodatki(fixture, "2026-01-17", "ljubljana")).toMatchObject({ title: "Sv. Anton Puščavnik", rank: "obvezni god" });
  });

  it("reads the Ljubljana diocese, not the general calendar", () => {
    expect(parseOsnovniPodatki(fixture, "2026-05-08", "ljubljana")?.title).toBe("Obletnica posvetitve ljubljanske stolnice");
    expect(parseOsnovniPodatki(fixture, "2026-05-08", "slovenija")?.title).toBe("Petek 5. velikonočnega tedna");
  });

  it("a date outside the file or a broken file gives null", () => {
    expect(parseOsnovniPodatki(fixture, "2028-01-01", "ljubljana")).toBeNull();
    expect(parseOsnovniPodatki({ nope: true }, "2026-10-28", "ljubljana")).toBeNull();
    expect(parseOsnovniPodatki(null, "2026-10-28", "ljubljana")).toBeNull();
  });

  it("links the day on hozana.si", () => {
    expect(hozanaUrl("2026-10-28")).toBe("https://hozana.si/?datum=28.10.2026");
  });
});

describe("fetchHozanaDay [unit]", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    resetHozanaMemory();
  });

  it("downloads the file once and keeps it for 24 h", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(fixture), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const t = Date.parse("2026-10-28T08:00:00Z");
    expect((await fetchHozanaDay("2026-10-28", t))?.title).toBe("Sv. Simon in Juda Tadej, apostola");
    expect((await fetchHozanaDay("2026-11-01", t + 60_000))?.title).toBe("Vsi sveti");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await fetchHozanaDay("2026-10-29", t + 25 * 3600_000);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("hozana down: null, logged once, not asked again for a while", async () => {
    const fetchMock = vi.fn(async () => new Response("", { status: 503 }));
    vi.stubGlobal("fetch", fetchMock);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const t = Date.parse("2026-10-28T08:00:00Z");
    expect(await fetchHozanaDay("2026-10-28", t)).toBeNull();
    expect(await fetchHozanaDay("2026-10-28", t + 1000)).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledTimes(1);
  });
});
