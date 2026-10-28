import { describe, expect, it } from "vitest";
import { cleanHref, isEmptyPortableText, preparePastedHtml, sanitizePortableText } from "./RichTextField.schema";

let n = 0;
const key = () => `k${++n}`;
const clean = (v: unknown, variant: "full" | "simple" = "full") => {
  n = 0;
  return sanitizePortableText(v, variant, key);
};

const block = (children: unknown[], extra: Record<string, unknown> = {}) => ({ _type: "block", _key: "b", style: "normal", markDefs: [], children, ...extra });
const span = (text: string, marks: string[] = []) => ({ _type: "span", _key: `s-${text}`, text, marks });

describe("sanitizePortableText", () => {
  it("keeps a clean value as it is (idempotent)", () => {
    const value = [
      block([span("Krepko", ["strong"]), span(" in "), span("povezava", ["l1"])], {
        _key: "a",
        markDefs: [{ _type: "link", _key: "l1", href: "https://zupnija-pirnice.si" }],
      }),
      block([span("Točka")], { _key: "c", listItem: "number", level: 1 }),
      { _type: "imageWithAlt", _key: "i", asset: { _type: "reference", _ref: "image-abc-10x10-jpg" }, alt: "Cerkev" },
      { _type: "attachment", _key: "f", title: "Prijavnica", file: { _type: "file", asset: { _type: "reference", _ref: "file-abc-pdf" } } },
    ];
    expect(clean(value)).toEqual(value);
    expect(clean(clean(value))).toEqual(value);
  });

  it("maps headings the site does not have to the nearest one", () => {
    const out = clean([block([span("a")], { _key: "1", style: "h1" }), block([span("b")], { _key: "2", style: "h5" }), block([span("c")], { _key: "3", style: "code" })]);
    expect(out.map((b) => b.style)).toEqual(["h2", "h3", "normal"]);
  });

  it("simple: only paragraphs and bullet lists, no objects", () => {
    const out = clean(
      [
        block([span("Naslov")], { _key: "1", style: "h2" }),
        block([span("Ena")], { _key: "2", listItem: "number", level: 2 }),
        { _type: "imageWithAlt", _key: "i", asset: { _type: "reference", _ref: "image-abc-10x10-jpg" } },
      ],
      "simple",
    );
    expect(out).toHaveLength(2);
    expect(out[0].style).toBe("normal");
    expect(out[1]).toMatchObject({ style: "normal", listItem: "bullet", level: 1 });
  });

  it("drops marks that are not strong, em or a link (underline, colours, code)", () => {
    const [b] = clean([block([span("x", ["strong", "underline", "code", "em", "strike-through"])])]);
    expect((b.children as { marks: string[] }[])[0].marks).toEqual(["strong", "em"]);
  });

  it("drops unsafe and unused links; adds https to a bare domain", () => {
    const [b] = clean([
      block([span("a", ["bad"]), span("b", ["good"]), span("c")], {
        markDefs: [
          { _type: "link", _key: "bad", href: "javascript:alert(1)" },
          { _type: "link", _key: "good", href: "www.zupnija-pirnice.si" },
          { _type: "link", _key: "unused", href: "https://x.si" },
          { _type: "comment", _key: "c", text: "?" },
        ],
      }),
    ]);
    expect(b.markDefs).toEqual([{ _type: "link", _key: "good", href: "https://www.zupnija-pirnice.si" }]);
    expect((b.children as { text: string; marks: string[] }[]).map((c) => [c.text, c.marks])).toEqual([
      ["a", []],
      ["b", ["good"]],
      ["c", []],
    ]);
  });

  it("joins neighbouring spans with the same marks (Word splits runs)", () => {
    const [b] = clean([block([span("Sve"), span("ta "), span("maša", ["strong"]), span(" ob", []), { _type: "span", text: " 8h" }])]);
    expect((b.children as { text: string }[]).map((c) => c.text)).toEqual(["Sveta ", "maša", " ob 8h"]);
  });

  it("drops inline objects and unknown blocks; fills an empty block with one span", () => {
    const out = clean([
      block([{ _type: "mention", _key: "m", user: "x" }]),
      { _type: "table", _key: "t", rows: [] },
      { _type: "code", _key: "c", code: "x" },
      "nonsense",
      null,
    ]);
    expect(out).toEqual([{ _type: "block", _key: "b", style: "normal", markDefs: [], children: [{ _type: "span", _key: "k1", text: "", marks: [] }] }]);
  });

  it("keeps only images and attachments with an uploaded asset; image → imageWithAlt", () => {
    const out = clean([
      { _type: "image", _key: "i1", asset: { _type: "reference", _ref: "image-a-1x1-png" }, alt: "A", extra: 1 },
      { _type: "imageWithAlt", _key: "i2", src: "https://example.com/x.png" },
      { _type: "attachment", _key: "f", title: "Brez datoteke" },
    ]);
    expect(out).toEqual([{ _type: "imageWithAlt", _key: "i1", asset: { _type: "reference", _ref: "image-a-1x1-png" }, alt: "A" }]);
  });

  it("gives missing and duplicate keys new ones", () => {
    const out = clean([
      { _type: "block", children: [{ _type: "span", text: "a" }] },
      block([span("b")], { _key: "x" }),
      block([span("c")], { _key: "x" }),
    ]);
    const keys = out.map((b) => b._key);
    expect(new Set(keys).size).toBe(3);
    expect(keys.every(Boolean)).toBe(true);
  });

  it("list items are normal paragraphs with a level of 1–3", () => {
    const [a, b] = clean([block([span("a")], { _key: "1", style: "h2", listItem: "bullet", level: 7 }), block([span("b")], { _key: "2", listItem: "checkbox" })]);
    expect(a).toMatchObject({ style: "normal", listItem: "bullet", level: 3 });
    expect(b).toMatchObject({ listItem: "bullet", level: 1 });
  });

  it("returns [] for anything that is not an array", () => {
    expect(clean(null)).toEqual([]);
    expect(clean({ _type: "block" })).toEqual([]);
  });
});

describe("cleanHref", () => {
  it.each([
    ["https://x.si/a?b=1", "https://x.si/a?b=1"],
    ["  http://x.si ", "http://x.si"],
    ["mailto:zupnija@x.si", "mailto:zupnija@x.si"],
    ["tel:+38612345678", "tel:+38612345678"],
    ["/verouk", "/verouk"],
    ["#kontakt", "#kontakt"],
    ["zupnija-pirnice.si/novice", "https://zupnija-pirnice.si/novice"],
    ["javascript:alert(1)", null],
    ["//evil.example", null],
    ["data:text/html,x", null],
    ["kar nekaj", null],
    ["", null],
  ])("%s → %s", (input, out) => {
    expect(cleanHref(input)).toBe(out);
  });
});

describe("isEmptyPortableText", () => {
  it("is empty for nothing, [] and blank paragraphs; not for text or an image", () => {
    expect(isEmptyPortableText(undefined)).toBe(true);
    expect(isEmptyPortableText([])).toBe(true);
    expect(isEmptyPortableText([block([span("  ")])])).toBe(true);
    expect(isEmptyPortableText([block([span("a")])])).toBe(false);
    expect(isEmptyPortableText([{ _type: "imageWithAlt", _key: "i" }])).toBe(false);
  });
});

describe("preparePastedHtml", () => {
  it("full: h1 → h2, h4–h6 → h3, Word's title style → h2", () => {
    expect(preparePastedHtml('<h1 class="x">A</h1><h4>B</h4><h6>C</h6><hr>', "full")).toBe('<h2 class="x">A</h2><h3>B</h3><h3>C</h3><hr>');
    expect(preparePastedHtml('<p class=MsoTitle style="x">Naslov</p><p class=MsoNormal>t</p>', "full")).toBe('<h2 class=MsoTitle style="x">Naslov</h2><p class=MsoNormal>t</p>');
  });
  it("leaves other tags alone (header, hr, h2) and does nothing for simple", () => {
    expect(preparePastedHtml("<header><h2>x</h2></header>", "full")).toBe("<header><h2>x</h2></header>");
    expect(preparePastedHtml("<h1>x</h1>", "simple")).toBe("<h1>x</h1>");
  });
  it("removes the bullets Word types out in list fallback markup (both variants)", () => {
    const fallback = "<p class=MsoListParagraph><![if !supportLists]><span>·<span>&nbsp; </span></span><![endif]>Ena</p>";
    const ignore = `<p class=MsoListParagraph><span style='font-family:Symbol'><span style='mso-list:Ignore'>1.<span style='font:7.0pt "Times"'>&nbsp;</span></span></span>Dva</p>`;
    for (const v of ["full", "simple"] as const) {
      expect(preparePastedHtml(fallback, v)).toBe("<p class=MsoListParagraph>Ena</p>");
      expect(preparePastedHtml(ignore, v)).toBe("<p class=MsoListParagraph><span style='font-family:Symbol'></span>Dva</p>");
    }
  });
});
