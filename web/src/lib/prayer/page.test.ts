/**
 * "Molitev in češčenje" (US-012): the prayerPage singleton saved through the
 * engine, as the priest does, and read back for /molitev and the homepage.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { perform } from "@/lib/admin/registry";
import { contentStore, readPrayerPage } from "@/lib/content/read";
import { validateContent } from "@/lib/content/schemas";
import { makeUser, resetDb } from "@/test/db";
import { prayerItemLine } from "./page";

const item = (key: string, title: string, when: string, place: string | null, onHome = false, note?: string) => ({
  _key: key,
  _type: "prayerItem",
  title,
  when,
  ...(place ? { place } : {}),
  ...(note ? { note } : {}),
  onHome,
});

const PAGE = {
  _type: "prayerPage",
  title: "Molitev in češčenje",
  items: [
    item("a", "Češčenje Najsvetejšega", "prvi petek v mesecu, 15.00–18.30", "Marijina cerkev", true),
    item("b", "Rožni venec", "oktober, pred večerno mašo", "Marijina cerkev", true),
    item("c", "Molitvena skupina", "vsako sredo ob 18.00", null, false, "Pridružite se lahko tudi v duhu."),
  ],
};

const read = async () => readPrayerPage(await contentStore());

describe("prayerPage [db]", () => {
  beforeEach(resetDb);

  it("the editor's form accepts the document", () => {
    expect(validateContent("prayerPage", PAGE)).toEqual([]);
  });

  it("3 saved items come back as 3 rows, in order, with the homepage flags", async () => {
    const owner = await makeUser("blaz", { isOwner: true });
    await perform(owner, "content.save", { type: "prayerPage", data: PAGE });
    const page = await read();
    expect(page?.items.map((i) => [i.title, prayerItemLine(i)])).toEqual([
      ["Češčenje Najsvetejšega", "prvi petek v mesecu, 15.00–18.30 · Marijina cerkev"],
      ["Rožni venec", "oktober, pred večerno mašo · Marijina cerkev"],
      ["Molitvena skupina", "vsako sredo ob 18.00"],
    ]);
    expect(page?.items.filter((i) => i.onHome)).toHaveLength(2);
    expect(page?.items[2].note).toBe("Pridružite se lahko tudi v duhu.");
  });

  it("no document, or one with 0 items: nothing to show", async () => {
    expect(await read()).toBeNull();
    const owner = await makeUser("blaz", { isOwner: true });
    await perform(owner, "content.save", { type: "prayerPage", data: { ...PAGE, items: [] } });
    expect((await read())?.items).toEqual([]);
  });
});
