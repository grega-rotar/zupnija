import { describe, expect, it } from "vitest";
import { navFor } from "@/components/admin/nav";
import { CONTENT_TYPES, initialDoc, isShown, slugify, titleOf, TYPES, type Field } from "@/lib/content/fields";
import { filterRows, newKey, sameDoc, serverErrorPath, validateDoc } from "./doc";

describe("content form helpers", () => {
  it("sameDoc ignores key order but not values", () => {
    expect(sameDoc({ a: 1, b: { c: 2, d: [1, { e: 1, f: 2 }] } }, { b: { d: [1, { f: 2, e: 1 }], c: 2 }, a: 1 })).toBe(true);
    expect(sameDoc({ a: 1 }, { a: 2 })).toBe(false);
    expect(sameDoc({ list: [1, 2] }, { list: [2, 1] })).toBe(false);
  });

  it("newKey makes 12-character hex keys", () => {
    const a = newKey();
    expect(a).toMatch(/^[0-9a-f]{12}$/);
    expect(newKey()).not.toBe(a);
  });

  it("filterRows matches every word in title or subtitle, case-insensitively", () => {
    const rows = [
      { title: "Sveta birma", subtitle: "Zakrament" },
      { title: "Krst", subtitle: "Zakrament" },
      { title: "Pogreb", subtitle: "Pastoralna služba" },
    ];
    expect(filterRows(rows, "")).toHaveLength(3);
    expect(filterRows(rows, "zakr")).toHaveLength(2);
    expect(filterRows(rows, "BIRMA zakrament").map((r) => r.title)).toEqual(["Sveta birma"]);
    expect(filterRows(rows, "nič")).toEqual([]);
  });

  it("validateDoc puts each problem on its field path", () => {
    const errors = validateDoc(TYPES.article, { _type: "article", title: "x".repeat(141), slug: { _type: "slug", current: "Ni Dobro" } });
    expect(errors.title).toMatch(/Največ 140/);
    expect(errors.slug).toBeTruthy();
    expect(errors.excerpt).toBe("To polje je obvezno.");
    expect(errors.body).toBe("Napišite besedilo.");
  });

  it("validateDoc checks nested objects and array items, and skips hidden link fields", () => {
    const errors = validateDoc(TYPES.homePage, {
      _type: "homePage",
      heroImage: { _type: "imageWithAlt", asset: { _type: "reference", _ref: "image-abc-10x10-jpg" } },
      featuredLinks: [
        { _key: "a", _type: "link", label: "Verouk", kind: "external" },
        { _key: "b", _type: "link", label: "Oznanila", kind: "internal", internal: { _type: "reference", _ref: "x" } },
      ],
    });
    expect(errors["featuredLinks.0.href"]).toBeTruthy();
    expect(errors["featuredLinks.0.internal"]).toBeUndefined();
    expect(Object.keys(errors).filter((k) => k.startsWith("featuredLinks.1"))).toEqual([]);
  });

  it("a fresh document of every type starts with the studio's initial values", () => {
    const now = new Date("2026-10-27T09:00:00Z");
    expect(initialDoc(TYPES.announcement, now)).toMatchObject({ _type: "announcement", category: "notice", importance: "normal", showOnHomepage: true, publishFrom: now.toISOString() });
    expect(initialDoc(TYPES.gallery, now)).toMatchObject({ date: "2026-10-27" });
    for (const t of CONTENT_TYPES) expect(initialDoc(TYPES[t], now)._type).toBe(t);
  });

  it("slugify makes Sanity-style addresses from Slovenian titles", () => {
    expect(slugify("Župnijska cerkev sv. Križa")).toBe("zupnijska-cerkev-sv-kriza");
    expect(slugify("  Verouk 2026/2027!  ")).toBe("verouk-2026-2027");
    expect(slugify("a".repeat(20) + " b", 10)).toBe("aaaaaaaaaa");
  });

  it("titleOf and serverErrorPath", () => {
    expect(titleOf(TYPES.church, { name: "Sv. Tomaž" })).toBe("Sv. Tomaž");
    expect(titleOf(TYPES.article, {})).toBe("Brez naslova");
    expect(titleOf(TYPES.settings, { name: "x" })).toBe("Nastavitve župnije");
    expect(serverErrorPath(TYPES.article, "Ta naslov že obstaja. Izberite drug spletni naslov.")).toBe("slug");
    expect(serverErrorPath(TYPES.settings, "Ta naslov že obstaja.")).toBeNull();
    expect(serverErrorPath(TYPES.article, "Neveljavni podatki.")).toBeNull();
  });

  it("isShown follows `when`", () => {
    const href = TYPES.homePage.fields.find((f) => f.name === "featuredLinks") as Extract<Field, { kind: "array" }>;
    const f = href.of[0].fields.find((x) => x.name === "href")!;
    expect(isShown(f, { kind: "external" })).toBe(true);
    expect(isShown(f, { kind: "internal" })).toBe(false);
  });
});

describe("the Spletna stran sidebar group", () => {
  const site = (u: Parameters<typeof navFor>[0]) => navFor(u).filter((n) => n.group === "Spletna stran").map((n) => n.label);

  it("shows the owner every content type, Nastavitve included", () => {
    expect(site({ isOwner: true, sections: [] })).toEqual([
      "Domača stran",
      "Strani",
      "Novice",
      "Obvestila",
      "Galerije",
      "Dokumenti",
      "Cerkve",
      "Skupine",
      "Duhovniki",
      "Zakramenti",
      "Verouk (stran)",
      "Urnik maš (opomba)",
      "Molitev",
      "Nameni darovanja",
      "Posebna obdobja",
      "Nastavitve",
    ]);
  });

  it("shows a helper only the areas they were given, never Nastavitve", () => {
    expect(site({ isOwner: false, sections: ["oznanila"] })).toEqual([]);
    expect(site({ isOwner: false, sections: ["zupnija"] })).toEqual(["Cerkve", "Skupine", "Duhovniki", "Zakramenti", "Verouk (stran)", "Urnik maš (opomba)", "Molitev", "Nameni darovanja"]);
    expect(site({ isOwner: false, sections: ["vsebina"] })).not.toContain("Nastavitve");
  });
});
