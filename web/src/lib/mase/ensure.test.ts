import { and, eq, gte, lte } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db, schema } from "@/db";
import { resetDb } from "@/test/db";
import { seedParish } from "@/test/seed";
import { ensureMasses } from "./ensure";

const m = schema.masses;
const between = (a: string, b: string) => and(gte(m.date, a), lte(m.date, b));

describe("seed and ensureMasses (US-001)", () => {
  beforeEach(resetDb);

  it("seeds churches, the schedule, 16 masses and the October intentions", async () => {
    const s = await seedParish(db);
    const churches = await db.select().from(schema.churches).orderBy(schema.churches.position);
    expect(churches.map((c) => c.shortName)).toEqual(["Marijina cerkev", "Sv. Križ", "Sv. Tomaž"]);
    expect(await db.select().from(schema.massScheduleEntries)).toHaveLength(6);
    expect(await db.select().from(m).where(between("2026-10-26", "2026-11-01"))).toHaveLength(8);
    expect(await db.select().from(m)).toHaveLength(16);
    const ints = await db.select().from(schema.intentions).where(eq(schema.intentions.massId, s.masses["2026-10-28 18:30"]));
    expect(ints.map((i) => [i.kind, i.text])).toEqual([["deceased", "Branko Babnik"]]);
    const [wed] = await db.select().from(m).where(eq(m.id, s.masses["2026-10-28 18:30"]));
    expect(wed.churchId).toBe(s.churches.marija);
    expect(await db.select().from(schema.changeRequests)).toHaveLength(2);
    expect(await db.select().from(schema.events)).toHaveLength(3);
    expect(await db.select().from(schema.user)).toHaveLength(5);
  });

  it("creates 8 masses for 1.–7. november, then 0 the second time", async () => {
    await seedParish(db);
    await db.delete(m).where(between("2026-11-01", "2026-11-07"));
    expect(await ensureMasses(db, "2026-11-01", "2026-11-07")).toBe(8);
    expect(await ensureMasses(db, "2026-11-01", "2026-11-07")).toBe(0);
    expect(await db.select().from(m).where(between("2026-11-01", "2026-11-07"))).toHaveLength(8);
  });

  it("never creates a mass on a day whose override replaces the schedule", async () => {
    await seedParish(db);
    await db.delete(m).where(between("2026-11-01", "2026-11-07"));
    await db.insert(schema.massDayOverrides).values({ date: "2026-11-01", replacesSchedule: true, label: "Romanje" });
    await db.insert(schema.massDayOverrides).values({ date: "2026-11-07", replacesSchedule: false });
    expect(await ensureMasses(db, "2026-11-01", "2026-11-07")).toBe(6);
    expect(await db.select().from(m).where(eq(m.date, "2026-11-01"))).toHaveLength(0);
    expect(await db.select().from(m).where(eq(m.date, "2026-11-07"))).toHaveLength(1);
  });

  it("respects validFrom/validUntil and drops untouched masses the schedule no longer has", async () => {
    const s = await seedParish(db);
    const se = schema.massScheduleEntries;
    // Thursday 7.00 ends before 5 November; an edited Mass is never removed.
    const [thu] = await db.select().from(se).where(eq(se.time, "07:00"));
    await db.update(se).set({ validUntil: "2026-11-04" }).where(eq(se.id, thu.id));
    await db.insert(se).values({ weekdays: [4], time: "19:00", churchId: s.churches.tomaz, validFrom: "2026-11-05" });
    await db.update(m).set({ editedAt: new Date() }).where(eq(m.id, s.masses["2026-10-29 07:00"]));
    expect(await ensureMasses(db, "2026-10-25", "2026-11-07")).toBe(1);
    const thursdays = await db.select().from(m).where(eq(m.date, "2026-11-05"));
    expect(thursdays.map((r) => r.time)).toEqual(["19:00:00"]);
    expect(await db.select().from(m).where(eq(m.id, s.masses["2026-10-29 07:00"]))).toHaveLength(1);
  });
});
