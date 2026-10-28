import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { loadActor } from "@/lib/admin/actor";
import { perform } from "@/lib/admin/engine";
import type { Actor } from "@/lib/admin/sections";
import { resetDb } from "@/test/db";
import { seedParish, type SeededParish } from "@/test/seed";
import "@/lib/mase/actions";
import "@/lib/dogodki/actions";
import "@/lib/verouk/actions";
import { firstName, pl, relativeStamp, SPREMEMBA_CAKA } from "./format";
import { loadHome } from "./loader";

let s: SeededParish;
const actor = async (id: string) => (await loadActor(db, id)) as Actor;

describe("Domov loader (US-004)", () => {
  beforeEach(async () => {
    await resetDb();
    s = await seedParish(db);
  });

  it("Blaž: next Mass, 2 approvals, missing bulletin, every Mass left this week has an intention", async () => {
    const h = await loadHome(await actor("blaz"));
    expect(h.greeting).toMatchObject({ eyebrow: "torek, 27. oktober", name: "gospod župnik", sub: "Tole je na vrsti ta teden." });
    expect(h.nextMass).toMatchObject({ date: "2026-10-27", time: "18:30", church: "Marijina cerkev", intentions: ["† Štefan Hrovat"] });
    expect(h.hero).toMatchObject({ kind: "mass", time: "18.30", label: "Naslednja maša · danes", place: "Marijina cerkev", detail: "sveta maša", note: "† Štefan Hrovat" });
    expect(h.approvals).toHaveLength(2);
    expect(h.approvals.map((a) => [a.what, a.where, a.byName, a.at])).toEqual([
      ["Nov namen † Ivana Kos", "nedelja, 1. november, 8.00, Sv. Križ", "Marta Zupan", "včeraj ob 19.42"],
      ["Nov dogodek: Čiščenje Marijine cerkve", "sobota, 7. november, 9.00, Marijina cerkev", "Marta Zupan", "danes ob 8.15"],
    ]);
    expect(h.mine).toEqual([]);
    expect(h.bulletinMissing).toEqual({ week: "2026-11-01" });
    expect(h.bulletin).toMatchObject({ status: "missing", span: "1.–7. november" });
    // This week is Sunday 25 – Saturday 31 October; last Sunday's Masses are past.
    expect(h.massesWithoutIntention).toEqual([]);
    expect(h.cancelledLessons).toEqual([]);
    expect(h.done).toEqual(["Oznanila za 25.–31. oktober so objavljena", "Urnik verouka velja do preklica", "Redni urnik maš velja do preklica"]);
  });

  it("Marta: no approvals, her own 2 items wait for the priest", async () => {
    const h = await loadHome(await actor("marta"));
    expect(h.greeting).toMatchObject({ name: "Marta", sub: "Tole je na vrsti ta teden. Spremembe pregleda župnik." });
    expect(h.approvals).toEqual([]);
    expect(h.mine).toHaveLength(2);
    expect(h.mine.map((a) => a.what)).toEqual(["Nov namen † Ivana Kos", "Nov dogodek: Čiščenje Marijine cerkve"]);
    expect(h.bulletinMissing).toEqual({ week: "2026-11-01" });
    expect(h.can).toEqual({ mase: true, oznanila: true, dogodki: true, verouk: false });
  });

  it("Ana: the next lesson today at 16.00, no Masses, no bulletin", async () => {
    const h = await loadHome(await actor("ana"));
    expect(h.greeting).toMatchObject({ name: "Ana", sub: "Tole je na vrsti pri verouku." });
    expect(h.hero).toEqual({ kind: "lesson", time: "16.00", label: "Naslednja ura verouka · danes", place: "1.–3. razred", detail: "14 otrok", note: "Veroučna učilnica v župnišču" });
    expect(h.nextMass).toBeNull();
    expect(h.massesWithoutIntention).toEqual([]);
    expect(h.bulletin).toBeNull();
    expect(h.approvals).toEqual([]);
    expect(h.mine).toEqual([]);
  });

  it("Ana: a cancelled lesson becomes a task and the hero moves to the next one", async () => {
    const ana = await actor("ana");
    await perform(ana, "lesson.cancel", { groupId: s.groups.g13, date: "2026-10-27", message: "Katehistinja je bolna." });
    const h = await loadHome(ana);
    expect(h.cancelledLessons.map((l) => l.line)).toEqual(["1.–3. razred, torek"]);
    expect(h.hero).toMatchObject({ time: "16.30", label: "Naslednja ura verouka · jutri", place: "4.–6. razred", detail: "17 otrok" });
  });

  it("where lines: a pending Mass cancellation carries the reason as its note", async () => {
    const marta = await actor("marta");
    await perform(marta, "mass.cancel", { massId: s.masses["2026-10-28 18:30"], reason: "Župnik je na duhovnih vajah.", intentionHandling: "keep" });
    const h = await loadHome(await actor("blaz"));
    const row = h.approvals.find((a) => a.what === "Odpoved maše")!;
    expect(row).toMatchObject({ where: "sreda, 28. oktober, 18.30, Marijina cerkev", note: "Župnik je na duhovnih vajah.", at: "danes ob 10.00" });
  });

  it("a Mass left this week without intention is a task; a pending intention fills it", async () => {
    await db.delete(schema.intentions).where(eq(schema.intentions.massId, s.masses["2026-10-31 18:30"]));
    const before = await loadHome(await actor("blaz"));
    expect(before.massesWithoutIntention).toHaveLength(1);
    expect(before.massesWithoutIntention[0]).toMatchObject({ id: s.masses["2026-10-31 18:30"], date: "2026-10-31", time: "18:30", line: "sobota 18.30, Marijina cerkev" });
    const marta = await actor("marta");
    await perform(marta, "intention.add", { massId: s.masses["2026-10-31 18:30"], text: "Ana Kos", kind: "deceased" });
    const h = await loadHome(await actor("blaz"));
    expect(h.massesWithoutIntention).toEqual([]);
    expect(h.approvals).toHaveLength(3);
  });

  it("a draft for next week replaces the missing bulletin", async () => {
    await db.insert(schema.bulletins).values({ weekStart: "2026-11-01", status: "draft", draft: { readable: true, items: [], notices: [] } });
    const h = await loadHome(await actor("blaz"));
    expect(h.bulletin).toMatchObject({ status: "draft", week: "2026-11-01" });
    expect(h.bulletinMissing).toBeNull();
  });
});

describe("Domov wording", () => {
  it("Slovenian number forms", () => {
    expect([1, 2, 3, 4, 5, 11, 101, 102].map((n) => pl(n, SPREMEMBA_CAKA))).toEqual([
      "1 sprememba čaka",
      "2 spremembi čakata",
      "3 spremembe čakajo",
      "4 spremembe čakajo",
      "5 sprememb čaka",
      "11 sprememb čaka",
      "101 sprememba čaka",
      "102 spremembi čakata",
    ]);
  });

  it("first names and stamps", () => {
    expect(firstName("msgr. dr. Blaž Jezeršek")).toBe("Blaž");
    expect(firstName("Marta Zupan")).toBe("Marta");
    const now = new Date("2026-10-27T10:00:00+01:00");
    expect(relativeStamp(new Date("2026-10-27T08:15:00+01:00"), now)).toBe("danes ob 8.15");
    expect(relativeStamp(new Date("2026-10-26T19:42:00+01:00"), now)).toBe("včeraj ob 19.42");
    expect(relativeStamp(new Date("2026-10-23T09:10:00+02:00"), now)).toBe("v petek ob 9.10");
    expect(relativeStamp(new Date("2026-10-12T09:10:00+02:00"), now)).toBe("12. 10. ob 9.10");
  });
});
