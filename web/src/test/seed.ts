/**
 * The parish data from PRD §10 "Test data setup", used by tests and the dev
 * seed (scripts/seed.ts). Expects empty tables. Clock: 2026-10-27 10:00.
 *
 * Imports the schema directly (not "@/db") so plain tsx scripts can run it.
 */
import type { Db, Tx } from "@/db";
import * as schema from "@/db/schema";
import { ensureMasses } from "@/lib/mase/ensure";

const at = (iso: string) => new Date(iso);

/** Ids of what other tests look up. */
export type SeededParish = {
  churches: { marija: number; kriz: number; tomaz: number };
  /** "2026-10-28 18:30" → mass id, for every seeded Mass. */
  masses: Record<string, number>;
  groups: { g13: number; g46: number; g79: number };
  changeRequests: { ivanaKos: number; ciscenje: number };
  bulletins: { w1019: number; w1026: number };
};

export async function seedParish(dbx: Db | Tx): Promise<SeededParish> {
  // ── Users ──
  const users = [
    { id: "blaz", name: "msgr. dr. Blaž Jezeršek", short: "BJ", title: "Župnik", isOwner: true, requiresApproval: false, sections: ["mase", "oznanila", "dogodki", "verouk"] as const, lastSeenAt: at("2026-10-27T09:40:00+01:00") },
    { id: "marta", name: "Marta Zupan", short: "MZ", title: "Tajnica", isOwner: false, requiresApproval: true, sections: ["mase", "oznanila", "dogodki"] as const, lastSeenAt: at("2026-10-27T08:15:00+01:00") },
    { id: "ana", name: "Ana Rozman", short: "AR", title: "Katehistinja", isOwner: false, requiresApproval: false, sections: ["verouk"] as const, lastSeenAt: at("2026-10-24T17:40:00+02:00") },
    { id: "tone", name: "Tone Kralj", short: "TK", title: "Zborovodja", isOwner: false, requiresApproval: true, sections: ["dogodki"] as const, invitedAt: at("2026-10-25T12:00:00+01:00") },
    { id: "disabled", name: "Nekdanji sodelavec", short: "NS", title: "Sodelavec", isOwner: false, requiresApproval: true, sections: [] as const, disabledAt: at("2026-09-01T12:00:00+02:00") },
  ];
  for (const { sections, ...u } of users) {
    await dbx.insert(schema.user).values({ ...u, email: `${u.id}@example.com`, emailVerified: u.id !== "tone" });
    if (sections.length) await dbx.insert(schema.userSections).values(sections.map((section) => ({ userId: u.id, section })));
  }

  // ── Churches and the regular schedule (studio/scripts/seed-parish-data.ts) ──
  const ch = await dbx
    .insert(schema.churches)
    .values([
      { slug: "marijino-vnebovzetje", name: "Župnijska cerkev Marijinega vnebovzetja", shortName: "Marijina cerkev", position: 1 },
      { slug: "sv-kriz", name: "Podružnična cerkev Povišanja svetega Križa", shortName: "Sv. Križ", position: 2 },
      { slug: "sv-tomaz", name: "Podružnična cerkev sv. Tomaža, apostola", shortName: "Sv. Tomaž", position: 3 },
    ])
    .returning();
  const churches = { marija: ch[0].id, kriz: ch[1].id, tomaz: ch[2].id };

  // weekdays: 0 = Sunday … 6 = Saturday
  await dbx.insert(schema.massScheduleEntries).values([
    { weekdays: [0], time: "08:00", churchId: churches.kriz, type: "sunday" },
    { weekdays: [0], time: "10:00", churchId: churches.marija, type: "sunday" },
    { weekdays: [6], time: "18:30", churchId: churches.marija, type: "sunday", note: "nedeljska maša v soboto zvečer" },
    { weekdays: [1, 5], time: "18:30", churchId: churches.kriz, type: "regular" },
    { weekdays: [2, 3], time: "18:30", churchId: churches.marija, type: "regular" },
    { weekdays: [4], time: "07:00", churchId: churches.marija, type: "regular" },
  ]);

  // ── Masses: two weeks, 16 rows ──
  await ensureMasses(dbx, "2026-10-26", "2026-11-08");
  const masses: Record<string, number> = {};
  for (const r of await dbx.select().from(schema.masses)) masses[`${r.date} ${r.time.slice(0, 5)}`] = r.id;

  // October bulletin intentions (published by the priest).
  const oct: [string, "deceased" | "thanksgiving" | "other", string][] = [
    ["2026-10-26 18:30", "deceased", "iz družin Pretnar in Jesihar"],
    ["2026-10-27 18:30", "deceased", "Štefan Hrovat"],
    ["2026-10-28 18:30", "deceased", "Branko Babnik"],
    ["2026-10-29 07:00", "thanksgiving", "v zahvalo"],
    ["2026-10-30 18:30", "other", "na čast Svetemu Duhu"],
    ["2026-10-31 18:30", "deceased", "iz družin Bezlaj in Jamnik"],
  ];
  await dbx.insert(schema.intentions).values(
    oct.map(([k, kind, text]) => ({ massId: masses[k], kind, text, createdBy: "blaz", createdAt: at("2026-10-25T18:05:00+01:00") })),
  );

  // ── Events ──
  await dbx.insert(schema.events).values([
    { title: "Molitev za rajne na pokopališču", date: "2026-11-01", time: "14:00", place: "Pokopališče Pirniče", description: "Po molitvi blagoslov grobov.", onFrontPage: true, createdBy: "blaz" },
    { title: "Uradne ure Karitas", date: "2026-11-02", time: "17:00", place: "Mežnarija v Spodnjih Pirničah", description: "Vsak prvi ponedeljek v mesecu od 17. do 18. ure.", createdBy: "blaz" },
    { title: "Srečanje staršev birmancev", date: "2026-11-13", time: "19:00", place: "Veroučna učilnica v župnišču", createdBy: "blaz" },
  ]);

  // ── Marta's changes waiting for the priest ──
  const [ivana] = await dbx
    .insert(schema.changeRequests)
    .values({
      section: "mase",
      action: "intention.add",
      payload: { massId: masses["2026-11-01 08:00"], text: "Ivana Kos", kind: "deceased" },
      label: "Nov namen † Ivana Kos",
      createdBy: "marta",
      createdAt: at("2026-10-26T19:42:00+01:00"),
    })
    .returning();
  const [ciscenje] = await dbx
    .insert(schema.changeRequests)
    .values({
      section: "dogodki",
      action: "event.save",
      payload: {
        title: "Čiščenje Marijine cerkve",
        date: "2026-11-07",
        time: "09:00",
        place: "Marijina cerkev",
        description: "Pred zahvalno nedeljo. Prinesite krpe in vedra.",
        onFrontPage: false,
      },
      label: "Nov dogodek: Čiščenje Marijine cerkve",
      createdBy: "marta",
      createdAt: at("2026-10-27T08:15:00+01:00"),
    })
    .returning();

  // ── Verouk ──
  const g = await dbx
    .insert(schema.catechesisGroups)
    .values([
      { name: "1.–3. razred", weekday: 2, time: "16:00", place: "Veroučna učilnica v župnišču", kids: 14, position: 1 },
      { name: "4.–6. razred", weekday: 3, time: "16:30", place: "Veroučna učilnica v župnišču", kids: 17, position: 2 },
      { name: "7.–9. razred, birmanci", weekday: 5, time: "17:30", place: "Mežnarija v Spodnjih Pirničah", kids: 11, position: 3 },
    ])
    .returning();

  // ── Bulletins: two published weeks; 2026-11-02 has no row (missing) ──
  const b = await dbx
    .insert(schema.bulletins)
    .values([
      { weekStart: "2026-10-19", status: "published", publishedAt: at("2026-10-18T18:00:00+02:00"), publishedBy: "blaz" },
      { weekStart: "2026-10-26", status: "published", publishedAt: at("2026-10-25T18:05:00+01:00"), publishedBy: "blaz" },
    ])
    .returning();

  return {
    churches,
    masses,
    groups: { g13: g[0].id, g46: g[1].id, g79: g[2].id },
    changeRequests: { ivanaKos: ivana.id, ciscenje: ciscenje.id },
    bulletins: { w1019: b[0].id, w1026: b[1].id },
  };
}
