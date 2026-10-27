import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/db";
import { loadActor } from "@/lib/admin/actor";
import { approve, undo } from "@/lib/admin/engine";
import type { Actor } from "@/lib/admin/sections";
import { setNow } from "@/lib/clock";
import { saveEvent } from "@/lib/dogodki/actions";
import { updateAccess } from "@/lib/ljudje/actions";
import { cancelLesson } from "@/lib/verouk/actions";
import { resetDb } from "@/test/db";
import { seedParish, type SeededParish } from "@/test/seed";
import { listHistory } from "./queries";

vi.mock("@/lib/mail", () => ({ sendMail: vi.fn(async () => ({ ok: true, delivered: true })) }));

const actor = async (id: string) => (await loadActor(db, id)) as Actor;
const labels = (days: Awaited<ReturnType<typeof listHistory>>) => days.flatMap((d) => d.entries.map((e) => e.label));

describe("listHistory", () => {
  let seed: SeededParish;
  let blaz: Actor, marta: Actor, ana: Actor;

  beforeEach(async () => {
    await resetDb();
    seed = await seedParish(db);
    [blaz, marta, ana] = await Promise.all(["blaz", "marta", "ana"].map(actor));

    // Sunday 25 Oct: the priest adds an event.
    setNow("2026-10-25T18:05:00+01:00");
    await saveEvent(blaz, { title: "Srečanje ključarjev", date: "2026-11-05", time: "08:00", place: "Marijina cerkev" });
    // Sunday 25 Oct: Ana cancels a Verouk lesson.
    setNow("2026-10-25T17:40:00+01:00");
    await cancelLesson(ana, { groupId: seed.groups.g79, date: "2026-10-30", message: "Počitnice." });
    // Yesterday: the priest changes Ana's access (owner-only area).
    setNow("2026-10-26T19:42:00+01:00");
    await updateAccess(blaz, { userId: "ana", sections: ["verouk"], requiresApproval: false });
    // Today: the priest approves Marta's event.
    setNow("2026-10-27T08:15:00+01:00");
    await approve(blaz, seed.changeRequests.ciscenje);
    setNow("2026-10-27T10:00:00+01:00");
  });
  afterEach(() => setNow(process.env.TEST_NOW ?? null));

  it("shows the owner everything, newest first, grouped by day", async () => {
    const days = await listHistory(blaz);
    expect(days.map((d) => d.label)).toEqual(["Danes", "Včeraj", "Nedelja, 25. oktober"]);
    expect(labels(days)).toEqual([
      "Potrjeno: Nov dogodek: Čiščenje Marijine cerkve",
      "Dostop za Ana Rozman",
      "Nov dogodek: Srečanje ključarjev",
      "Verouk 7.–9. razred, birmanci odpade",
    ]);
    const [today] = days;
    expect(today.entries[0]).toMatchObject({ at: "8.15", note: "predlog: Marta Zupan", canUndo: true, undone: false });
    expect(days[2].entries[0]).toMatchObject({ at: "18.05", who: { id: "blaz", short: "BJ", isOwner: true } });
    // The owner may undo anyone's change.
    expect(days.flatMap((d) => d.entries).every((e) => e.canUndo)).toBe(true);
  });

  it("shows Ana only Verouk entries (and her own)", async () => {
    const days = await listHistory(ana);
    expect(labels(days)).toEqual(["Verouk 7.–9. razred, birmanci odpade"]);
    expect(days[0].entries[0]).toMatchObject({ canUndo: true, who: { id: "ana" } });
  });

  it("shows Marta her sections but not Verouk or people, and only her own entries are undoable", async () => {
    const days = await listHistory(marta);
    expect(labels(days)).toEqual(["Potrjeno: Nov dogodek: Čiščenje Marijine cerkve", "Nov dogodek: Srečanje ključarjev"]);
    expect(days.flatMap((d) => d.entries).some((e) => e.canUndo)).toBe(false);
  });

  it("includes a helper's own entries outside their sections", async () => {
    // Ana loses Verouk but still sees the change she made there.
    await updateAccess(blaz, { userId: "ana", sections: ["mase"], requiresApproval: false });
    const days = await listHistory(await actor("ana"));
    expect(labels(days)).toEqual(["Verouk 7.–9. razred, birmanci odpade"]);
  });

  it("marks undone entries and does not offer undo for them or for the undo row", async () => {
    const [h] = (await listHistory(ana))[0].entries;
    await undo(ana, h.id);
    const entries = (await listHistory(ana)).flatMap((d) => d.entries);
    expect(entries.map((e) => [e.label, e.undone, e.canUndo])).toEqual([
      ["Razveljavljeno: Verouk 7.–9. razred, birmanci odpade", false, false],
      ["Verouk 7.–9. razred, birmanci odpade", true, false],
    ]);
  });

  it("respects the limit", async () => {
    expect(labels(await listHistory(blaz, { limit: 2 }))).toHaveLength(2);
  });
});
