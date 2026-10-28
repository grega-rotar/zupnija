/**
 * Website content in the editor: content.save / delete / reorder / publish
 * through the engine (areas, approval, history, undo), the public read layer
 * seeing the result, uploads (storeMedia) and the /media transforms.
 */
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { eq } from "drizzle-orm";
import postgres from "postgres";
import sharp from "sharp";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { db, schema } from "@/db";
import { approve, perform, undo } from "@/lib/admin/registry";
import { ForbiddenError } from "@/lib/admin/errors";
import { makeUser, resetDb } from "@/test/db";
import * as data from "@/sanity/data";
import exportFixture from "@/test/fixtures/sanity-export.json";
import { importContent } from "../../../scripts/import-sanity-content-lib.mjs";
import { TYPES, type ContentType } from "./fields";
import { validateContent } from "./schemas";
import { idFromFileName, mediaAbsPath, parseTransform, render, storeMedia } from "./storage";

const sql = postgres(process.env.DATABASE_URL!, { max: 1, onnotice: () => {} });
afterAll(() => sql.end());

async function seed() {
  await resetDb();
  await importContent(sql, exportFixture as never, { store: async (a: { size?: number }) => ({ sha256: "0".repeat(64), size: a.size ?? 0 }) });
  return {
    blaz: await makeUser("blaz", { isOwner: true, name: "msgr. dr. Blaž Jezeršek" }),
    marta: await makeUser("marta", { name: "Marta Zupan", sections: ["vsebina"], requiresApproval: true }),
    ana: await makeUser("ana", { name: "Ana Rozman", sections: ["zupnija"] }),
    tine: await makeUser("tine", { name: "Tine Kos", sections: ["vsebina"] }),
  };
}

const block = (text: string) => ({ _type: "block", _key: "b1", style: "normal", markDefs: [], children: [{ _type: "span", _key: "s1", text, marks: [] }] });
const ARTICLE = {
  _type: "article",
  title: "Martinovanje v župniji",
  slug: { _type: "slug", current: "martinovanje-2026" },
  publishedAt: "2026-10-20T08:00:00.000Z",
  excerpt: "Kratko.",
  body: [block("Vabljeni na martinovanje.")],
};
const row = async (id: string) => (await db.select().from(schema.content).where(eq(schema.content.id, id)))[0];

describe("the imported documents", () => {
  it("all pass their type's validation, so the priest can save them unchanged", () => {
    const problems = (exportFixture.documents as Array<{ _id: string; _type: string }>)
      .filter((d) => d._type in TYPES)
      .flatMap((d) => validateContent(d._type as ContentType, d).map((i) => `${d._id} ${i.path.join(".")}: ${i.message}`));
    expect(problems).toEqual([]);
  });
});

describe("content.save", () => {
  let users: Awaited<ReturnType<typeof seed>>;
  beforeEach(async () => {
    users = await seed();
  });

  it("the owner creates an article: a uuid row, history, on the site at once; undo removes it", async () => {
    const r = await perform(users.blaz, "content.save", { type: "article", data: ARTICLE });
    expect(r.status).toBe("applied");
    const id = (r as { result: { id: string } }).result.id;
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
    expect(await row(id)).toMatchObject({ type: "article", slug: "martinovanje-2026", published: true, createdBy: "blaz" });
    expect((await row(id)).data).toMatchObject({ _id: id, _type: "article", title: "Martinovanje v župniji" });
    const [h] = await db.select().from(schema.history);
    expect(h).toMatchObject({ section: "vsebina", action: "content.save", label: "Novo: Martinovanje v župniji" });

    expect((await data.getArticle("martinovanje-2026"))?.title).toBe("Martinovanje v župniji");
    expect((await data.getArticles())[0].slug).toBe("martinovanje-2026");

    await undo(users.blaz, (r as { historyId: number }).historyId);
    expect(await row(id)).toBeUndefined();
    expect(await data.getArticle("martinovanje-2026")).toBeNull();
  });

  it("replaces an imported document and keeps its id; undo restores the Sanity version", async () => {
    const before = await row("sacrament-krst");
    const doc = { ...before.data, title: "Sveti krst" };
    const r = await perform(users.ana, "content.save", { id: "sacrament-krst", type: "sacrament", data: doc });
    expect(r.status).toBe("applied");
    expect((await data.getSacrament("krst"))?.title).toBe("Sveti krst");
    expect((await row("sacrament-krst")).updatedAt > before.updatedAt).toBe(true);
    const [h] = await db.select().from(schema.history);
    expect(h).toMatchObject({ section: "zupnija", label: "Sprememba: Sveti krst" });
    await undo(users.ana, (r as { historyId: number }).historyId);
    expect(await row("sacrament-krst")).toEqual(before);
  });

  it("refuses a slug that another document of the type has", async () => {
    await expect(perform(users.blaz, "content.save", { type: "article", data: { ...ARTICLE, slug: { _type: "slug", current: "marijino-vnebovzetje" } } })).rejects.toThrow(
      "Ta naslov že obstaja",
    );
  });

  it("validates with the form's messages", async () => {
    await expect(perform(users.blaz, "content.save", { type: "article", data: { ...ARTICLE, title: "" } })).rejects.toThrow("To polje je obvezno.");
    await expect(perform(users.blaz, "content.save", { type: "article", data: { ...ARTICLE, slug: { _type: "slug", current: "Ž ž" } } })).rejects.toThrow(
      "Samo male črke",
    );
  });

  it("areas: Ana (Župnija) edits churches but not news; settings are the owner's", async () => {
    await expect(perform(users.ana, "content.save", { type: "article", data: ARTICLE })).rejects.toBeInstanceOf(ForbiddenError);
    await expect(perform(users.tine, "content.save", { id: "settings", type: "settings", data: (await row("settings")).data })).rejects.toBeInstanceOf(
      ForbiddenError,
    );
    const r = await perform(users.blaz, "content.save", { id: "settings", type: "settings", data: { ...(await row("settings")).data, phone: "01 111 11 11" } });
    expect(r.status).toBe("applied");
    expect((await data.getSettings())?.phone).toBe("01 111 11 11");
  });

  it("Marta's change waits for the owner; approving applies it", async () => {
    const r = await perform(users.marta, "content.save", { type: "article", data: ARTICLE });
    expect(r.status).toBe("pending");
    expect(await data.getArticle("martinovanje-2026")).toBeNull();
    const [cr] = await db.select().from(schema.changeRequests);
    expect(cr).toMatchObject({ section: "vsebina", label: "Novo: Martinovanje v župniji" });
    await approve(users.blaz, cr.id);
    expect((await data.getArticle("martinovanje-2026"))?.title).toBe("Martinovanje v župniji");
    const [created] = await db.select().from(schema.content).where(eq(schema.content.slug, "martinovanje-2026"));
    expect(created.createdBy).toBe("marta");
  });
});

describe("content.delete / reorder / publish", () => {
  let users: Awaited<ReturnType<typeof seed>>;
  beforeEach(async () => {
    users = await seed();
  });

  it("refuses to delete what is referenced, and only the owner deletes", async () => {
    await expect(perform(users.blaz, "content.delete", { id: "person-blaz-jezersek" })).rejects.toThrow(/^Na to se sklicuje: .*Krst/);
    await expect(perform(users.tine, "content.delete", { id: "article-roznovenska-mati-bozja" })).rejects.toBeInstanceOf(ForbiddenError);
    const r = await perform(users.blaz, "content.delete", { id: "article-roznovenska-mati-bozja" });
    expect(r.status).toBe("applied");
    expect(await data.getArticle("roznovenska-mati-bozja")).toBeNull();
    await undo(users.blaz, (r as { historyId: number }).historyId);
    expect((await data.getArticle("roznovenska-mati-bozja"))?.title).toBe("Rožnovenska Mati Božja");
  });

  it("reorders churches: sort and the document's order field", async () => {
    const ids = ["church-sv-tomaz", "church-sv-kriz", "church-marijino-vnebovzetje"];
    expect((await data.getChurches()).map((c) => c._id)).not.toEqual(ids);
    await perform(users.ana, "content.reorder", { type: "church", ids });
    expect((await data.getChurches()).map((c) => c._id)).toEqual(ids);
    expect((await row("church-sv-tomaz")).data.order).toBe(1);
  });

  it("hides a document from the site and shows it again", async () => {
    await perform(users.ana, "content.publish", { id: "sacrament-pogreb", published: false });
    expect((await data.getSacraments()).map((s) => s.slug)).not.toContain("pogreb");
    expect(await data.getSacrament("pogreb")).toBeNull();
    await perform(users.ana, "content.publish", { id: "sacrament-pogreb", published: true });
    expect((await data.getSacraments()).map((s) => s.slug)).toContain("pogreb");
  });

  it("a re-import keeps documents edited in the editor", async () => {
    const doc = { ...(await row("sacrament-krst")).data, title: "Sveti krst" };
    await perform(users.blaz, "content.save", { id: "sacrament-krst", type: "sacrament", data: doc });
    const r = await importContent(sql, exportFixture as never, { store: async () => ({ sha256: "x", size: 0 }) });
    expect(r.kept).toEqual(["sacrament-krst"]);
    expect((await row("sacrament-krst")).data.title).toBe("Sveti krst");
  });
});

describe("media", () => {
  let dir: string;
  beforeAll(async () => {
    dir = await mkdtemp(path.join(os.tmpdir(), "media-"));
    process.env.UPLOAD_DIR = dir;
  });
  afterAll(() => rm(dir, { recursive: true, force: true }));
  beforeEach(resetDb);

  const png = (w: number, h: number) => sharp({ create: { width: w, height: h, channels: 3, background: { r: 200, g: 150, b: 50 } } }).png().toBuffer();

  it("stores an image with a Sanity-style id, a placeholder, and dedupes by content", async () => {
    const bytes = await png(300, 200);
    const a = await storeMedia({ name: "Cerkev.png", type: "image/png", bytes }, null);
    expect(a.id).toMatch(/^image-[a-f0-9]{40}-300x200-png$/);
    expect(a.url).toMatch(/^\/media\/images\/hnwav9pa\/production\/[a-f0-9]{40}-300x200\.png$/);
    const [m] = await db.select().from(schema.media);
    expect(m).toMatchObject({ kind: "image", width: 300, height: 200, filename: "Cerkev.png", mime: "image/png" });
    expect(m.lqip).toMatch(/^data:image\/webp;base64,/);
    expect(await readFile(mediaAbsPath(m.path))).toEqual(bytes);
    const again = await storeMedia({ name: "kopija.png", type: "image/png", bytes }, null);
    expect(again.id).toBe(a.id);
    expect(await db.select().from(schema.media)).toHaveLength(1);
    expect(idFromFileName("images", a.url.split("/").pop()!)).toBe(a.id);
  });

  it("stores a PDF as a file and refuses unknown types", async () => {
    const f = await storeMedia({ name: "Prijavnica.pdf", type: "application/pdf", bytes: Buffer.from("%PDF-1.4 test") }, null);
    expect(f.id).toMatch(/^file-[a-f0-9]{40}-pdf$/);
    expect(idFromFileName("files", f.url.split("/").pop()!)).toBe(f.id);
    await expect(storeMedia({ name: "virus.exe", type: "application/octet-stream", bytes: Buffer.from("MZ") }, null)).rejects.toThrow("Te vrste datoteke");
  });

  it("renders the CDN parameters: rect + crop to a box, auto=format → webp, fit inside", async () => {
    const src = await png(400, 300);
    const t = parseTransform(new URLSearchParams("rect=0,50,400,200&w=200&h=100&fit=crop&q=70&auto=format"), "png");
    expect(t).toMatchObject({ rect: [0, 50, 400, 200], w: 200, h: 100, fit: "crop", format: "webp" });
    const meta = await sharp(await render(src, t)).metadata();
    expect(meta).toMatchObject({ format: "webp", width: 200, height: 100 });
    const inside = await sharp(await render(src, parseTransform(new URLSearchParams("w=1000"), "png"))).metadata();
    expect(inside).toMatchObject({ format: "png", width: 400, height: 300 });
  });
});
