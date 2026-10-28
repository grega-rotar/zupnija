// @vitest-environment jsdom
/*
 * Paste end to end, minus the browser: the same HTML importer the editor runs
 * on paste (@portabletext/html with our schema), then our two steps
 * (preparePastedHtml before, sanitizePortableText after).
 */
import { describe, expect, it } from "vitest";
import { htmlToPortableText } from "@portabletext/html";
import { compileSchema } from "@portabletext/schema";
import { preparePastedHtml, sanitizePortableText, SCHEMAS, type RichTextVariant } from "./RichTextField.schema";

function paste(html: string, variant: RichTextVariant) {
  let n = 0;
  const keyGenerator = () => `k${++n}`;
  const blocks = htmlToPortableText(preparePastedHtml(html, variant), { schema: compileSchema(SCHEMAS[variant]), keyGenerator });
  return sanitizePortableText(blocks, variant, keyGenerator);
}

type B = { style?: string; listItem?: string; markDefs?: { href: string }[]; children?: { text: string; marks: string[] }[] };
const text = (b: B) => (b.children ?? []).map((c) => c.text).join("");

// Trimmed from what Word for Windows puts on the clipboard.
const WORD = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word">
<head><meta name=Generator content="Microsoft Word 15"><style><!-- p.MsoNormal {margin:0cm} --></style></head>
<body lang=SL>
<!--StartFragment-->
<h1>Oznanila</h1>
<p class=MsoNormal><b><span style='font-size:14pt;color:#C00000'>Sveta maša</span></b><span style='color:#C00000'> bo ob </span><u>8.00</u><span style='font-family:"Comic Sans MS"'> v cerkvi.</span><o:p></o:p></p>
<p class=MsoNormal><i>Lepo vabljeni</i> na <a href="https://zupnija-pirnice.si/verouk">verouk</a>.<o:p></o:p></p>
<p class=MsoListParagraphCxSpFirst style='mso-list:l0 level1 lfo1'><![if !supportLists]><span>·<span>&nbsp;&nbsp;</span></span><![endif]>Prva točka<o:p></o:p></p>
<p class=MsoListParagraphCxSpLast style='mso-list:l0 level1 lfo1'><span style='font-family:Symbol'><span style='mso-list:Ignore'>·<span style='font:7.0pt "Times New Roman"'>&nbsp;&nbsp; </span></span></span>Druga točka<o:p></o:p></p>
<table><tr><td>Celica</td></tr></table>
<p class=MsoNormal><a href="javascript:alert(1)">klik</a><o:p></o:p></p>
<!--EndFragment-->
</body></html>`;

describe("paste from Word", () => {
  it("full: keeps headings, bold, italic, links and lists; drops colours, fonts, underline and bad links", () => {
    const out = paste(WORD, "full") as B[];
    expect(out[0]).toMatchObject({ style: "h2" });
    expect(text(out[0])).toBe("Oznanila");

    const p1 = out[1];
    expect(text(p1)).toBe("Sveta maša bo ob 8.00 v cerkvi.");
    const marks = new Set(p1.children!.flatMap((c) => c.marks));
    expect([...marks]).toEqual(["strong"]);

    const p2 = out[2];
    expect(p2.children!.find((c) => c.text.includes("Lepo"))!.marks).toEqual(["em"]);
    expect(p2.markDefs).toEqual([expect.objectContaining({ _type: "link", href: "https://zupnija-pirnice.si/verouk" })]);

    const items = out.filter((b) => b.listItem);
    expect(items.map(text).map((t) => t.trim())).toEqual(["Prva točka", "Druga točka"]);
    expect(items.every((b) => b.listItem === "bullet")).toBe(true);

    const last = out.at(-1)!;
    expect(text(last)).toBe("klik");
    expect(last.markDefs).toEqual([]);

    // Nothing outside the schema survives anywhere.
    for (const b of out) {
      expect(["normal", "h2", "h3", "blockquote"]).toContain(b.style);
      for (const c of b.children ?? []) for (const m of c.marks) expect(["strong", "em", ...(b.markDefs ?? []).map((d) => (d as { _key?: string })._key)]).toContain(m);
    }
  });

  it("simple: everything becomes paragraphs and bullet lists with bold, italic and links", () => {
    const out = paste(WORD, "simple") as B[];
    expect(out.every((b) => b.style === "normal")).toBe(true);
    expect(out.filter((b) => b.listItem).every((b) => b.listItem === "bullet")).toBe(true);
    expect(out[0].children!.map((c) => c.text).join("")).toBe("Oznanila");
  });
});

describe("paste from the web", () => {
  it("drops images, code, underline and h4 styles that the site does not have", () => {
    const html = `<article><h4>Urnik</h4><p>Ena <code>dva</code> <s>tri</s> <mark>štiri</mark></p><img src="https://example.com/x.jpg" alt="x"><ol><li>a</li><li>b</li></ol><blockquote>Citat</blockquote></article>`;
    const out = paste(html, "full") as B[];
    expect(out.map((b) => b.style ?? b)).toEqual(["h3", "normal", "normal", "normal", "blockquote"]);
    expect(out.filter((b) => b.listItem).map((b) => b.listItem)).toEqual(["number", "number"]);
    expect(out.flatMap((b) => b.children ?? []).flatMap((c) => c.marks)).toEqual([]);
    expect(out.some((b) => (b as { _type?: string })._type !== "block")).toBe(false);
  });
});
