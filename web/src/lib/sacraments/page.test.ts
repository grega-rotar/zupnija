/**
 * /zakramenti (ZUP-11, ZUP-12): the tabs and their hashes, the 301s from the
 * retired subpages and the enquiry form, and the "vsebina" placeholders in
 * the editor's new document, the import and the page before the first save.
 */
import postgres from "postgres";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db, schema } from "@/db";
import { perform } from "@/lib/admin/registry";
import { contentStore, readSacramentsPage } from "@/lib/content/read";
import { initialDoc, placeholderText, TYPES } from "@/lib/content/fields";
import { validateContent } from "@/lib/content/schemas";
import { pathForDocument } from "@/lib/routes";
import { makeUser, resetDb } from "@/test/db";
import { GET } from "@/app/(site)/zakramenti/[slug]/route";
import { DEFAULT_DOCUMENTS, importContent } from "../../../scripts/import-sanity-content-lib.mjs";
import { ARRANGE_HEADING, oldSacramentPath, SACRAMENT_TABS, tabFromHash } from "./tabs";

const sql = postgres(process.env.DATABASE_URL!, { max: 1, onnotice: () => {} });
afterAll(() => sql.end());

const text = (v: unknown) => (Array.isArray(v) ? v.flatMap((b) => b.children?.map((c: { text: string }) => c.text) ?? []).join(" ") : null);
const para = (t: string) => [{ _type: "block", _key: "p1", style: "normal", markDefs: [], children: [{ _type: "span", _key: "s1", text: t, marks: [] }] }];
const read = async () => readSacramentsPage(await contentStore());
const redirect = async (slug: string) => {
  const res = await GET(new Request(`http://localhost/zakramenti/${slug}`), { params: Promise.resolve({ slug }) });
  return [res.status, res.headers.get("location")];
};

describe("the tabs", () => {
  it("six sacraments in order, then Katehumenat and Pogreb set apart, each name once", () => {
    expect(SACRAMENT_TABS.map((t) => [t.label, !!t.apart])).toEqual([
      ["Sveti krst", false],
      ["Prvo sveto obhajilo", false],
      ["Sveta birma", false],
      ["Sveta spoved", false],
      ["Sveti zakon", false],
      ["Sveto bolniško maziljenje", false],
      ["Katehumenat", true],
      ["Pogreb", true],
    ]);
    expect(SACRAMENT_TABS.map((t) => t.about)).toEqual([...Array(6).fill("Kaj je ta zakrament"), "Kaj je katehumenat", "Cerkveni pogreb"]);
    expect(ARRANGE_HEADING).toBe("Kako se dogovorite v naši župniji");
  });

  it("the hash opens its tab: #krst, #katehumenat, #pogreb; anything else the first", () => {
    expect(SACRAMENT_TABS.map((t) => t.key)).toEqual(["krst", "obhajilo", "birma", "spoved", "zakon", "maziljenje", "katehumenat", "pogreb"]);
    expect(tabFromHash("#krst")).toBe("krst");
    expect(tabFromHash("#katehumenat")).toBe("katehumenat");
    expect(tabFromHash("#pogreb")).toBe("pogreb");
    expect(tabFromHash("#POGREB")).toBe("pogreb");
    expect(tabFromHash("")).toBe("krst");
    expect(tabFromHash("#neki")).toBe("krst");
  });
});

describe("old URLs [db]", () => {
  beforeEach(resetDb);

  it("every old subpage moves (301) to its tab", async () => {
    const old: Record<string, string> = {
      krst: "/zakramenti#krst",
      "prvo-sveto-obhajilo": "/zakramenti#obhajilo",
      "sveta-birma": "/zakramenti#birma",
      spoved: "/zakramenti#spoved",
      poroka: "/zakramenti#zakon",
      "bolnisko-maziljenje": "/zakramenti#maziljenje",
      pogreb: "/zakramenti#pogreb",
    };
    for (const [slug, to] of Object.entries(old)) expect(await redirect(slug)).toEqual([301, to]);
  });

  it("the enquiry form and unknown slugs move to the page", async () => {
    expect(await redirect("povprasevanje")).toEqual([301, "/zakramenti"]);
    expect(await redirect("ni-takega")).toEqual([301, "/zakramenti"]);
  });

  it("a slug renamed in the editor follows its old document's kind", async () => {
    await db.insert(schema.content).values({ id: "sacrament-x", type: "sacrament", slug: "pokop", data: { _id: "sacrament-x", _type: "sacrament", kind: "funeral", slug: { current: "pokop" } } });
    expect(await redirect("pokop")).toEqual([301, "/zakramenti#pogreb"]);
    expect(oldSacramentPath("ni-takega", "marriage")).toBe("/zakramenti#zakon");
    // Links that still point at an old sacrament document go straight to the tab.
    expect(pathForDocument("sacrament", "poroka")).toBe("/zakramenti#zakon");
  });
});

describe("content: 'vsebina' until the priest writes [db]", () => {
  beforeEach(resetDb);

  it("the editor's new document has 'vsebina' in the intro and both texts of every tab, no images", () => {
    const doc = initialDoc(TYPES.sacramentsPage);
    expect(text(doc.intro)).toBe("vsebina");
    for (const t of SACRAMENT_TABS) {
      expect(doc[t.key]).toEqual({ about: placeholderText(), arrange: placeholderText() });
    }
    expect(validateContent("sacramentsPage", doc)).toEqual([]);
  });

  it("the import creates the same document, and never replaces the priest's", async () => {
    const { _id, ...imported } = DEFAULT_DOCUMENTS[0];
    expect(_id).toBe("sacramentsPage");
    expect(imported).toEqual(initialDoc(TYPES.sacramentsPage));

    const empty = { documents: [], assets: [] };
    expect((await importContent(sql, empty, { store: async () => ({ sha256: "", size: 0 }) })).inserted).toBe(1);
    const [row] = await db.select().from(schema.content);
    expect(row).toMatchObject({ id: "sacramentsPage", type: "sacramentsPage", published: true });

    const owner = await makeUser("blaz", { isOwner: true });
    await perform(owner, "content.save", { type: "sacramentsPage", data: { ...row.data, intro: para("Zakramenti so znamenja.") } });
    expect((await importContent(sql, empty, { store: async () => ({ sha256: "", size: 0 }) })).inserted).toBe(0);
    expect(text((await read()).intro)).toBe("Zakramenti so znamenja.");
  });

  it("before any save the page shows 'vsebina' in every tab, without images", async () => {
    const page = await read();
    expect(text(page.intro)).toBe("vsebina");
    expect(page.tabs.map((t) => [t.key, text(t.aboutText), text(t.arrangeText), t.image])).toEqual(SACRAMENT_TABS.map((t) => [t.key, "vsebina", "vsebina", null]));
  });

  it("the priest's texts and an image come back on their tab", async () => {
    const owner = await makeUser("blaz", { isOwner: true });
    const doc = initialDoc(TYPES.sacramentsPage);
    const pogreb = { about: para("Cerkveni pogreb je …"), arrange: [] };
    await perform(owner, "content.save", { type: "sacramentsPage", data: { ...doc, pogreb } });
    const tab = (await read()).tabs.find((t) => t.key === "pogreb")!;
    expect([tab.label, tab.about, text(tab.aboutText), tab.arrangeText]).toEqual(["Pogreb", "Cerkveni pogreb", "Cerkveni pogreb je …", []]);
    expect((await read()).tabs[0].image).toBeNull();
  });
});
