import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db, schema } from "@/db";
import { loadActor } from "@/lib/admin/actor";
import { perform, undo } from "@/lib/admin/engine";
import type { Actor } from "@/lib/admin/sections";
import { PARISH, seedSettings } from "@/lib/forms/test-support";
import { clearDevOutbox, devOutbox } from "@/lib/mail";
import { resetDb } from "@/test/db";
import { seedParish, type SeededParish } from "@/test/seed";
import { enrolmentsCsv, isEnrolmentOpen, listEnrolments, schoolYear, submitEnrolment } from "./enrolment";

let s: SeededParish;
const rows = () => db.select().from(schema.catechesisEnrolments);

/** PRD §10 style seed data: both parents, a 4th-grader in 4.–6. razred. */
const valid = () => ({
  fatherName: "Marko Kralj",
  fatherEmail: "marko@example.com",
  fatherPhone: "041 111 222",
  motherName: "Ana Kralj",
  motherEmail: "ana@example.com",
  motherPhone: "041 123 456",
  childFirstName: "Žiga",
  childLastName: "Kralj",
  birthDate: "2017-03-14",
  birthPlace: "Ljubljana",
  baptismDate: "2017-06-04",
  baptismParish: "Pirniče",
  address: "Cesta v Zbilje 1, 1215 Medvode",
  grade: "4",
  groupId: String(s.groups.g46),
  activities: ["ministranti", "skavti"],
  photoArchive: "on",
  photoPublish: "",
  rules: "on",
});

describe("Verouk enrolment (US-006)", () => {
  beforeEach(async () => {
    await resetDb();
    s = await seedParish(db);
    await seedSettings();
    clearDevOutbox();
  });

  it("stores the whole enrolment with number V-2026-0001", async () => {
    const r = await submitEnrolment(valid(), { ip: "1.1.1.1" });
    expect(r.ok).toBe(true);
    const [row] = await rows();
    expect(row).toMatchObject({ number: "V-2026-0001", schoolYear: "2026/2027", childName: "Žiga Kralj", grade: 4, groupId: s.groups.g46, status: "new" });
    expect(row.data).toMatchObject({
      fatherName: "Marko Kralj",
      fatherEmail: "marko@example.com",
      fatherPhone: "041 111 222",
      motherName: "Ana Kralj",
      motherEmail: "ana@example.com",
      motherPhone: "041 123 456",
      childFirstName: "Žiga",
      childLastName: "Kralj",
      birthDate: "2017-03-14",
      birthPlace: "Ljubljana",
      baptismDate: "2017-06-04",
      baptismParish: "Pirniče",
      address: "Cesta v Zbilje 1, 1215 Medvode",
      activities: ["ministranti", "skavti"],
      photoArchive: true,
      photoPublish: false,
      rulesAccepted: true,
    });
    // The next one counts on.
    await submitEnrolment({ ...valid(), childFirstName: "Neža" }, { ip: "1.1.1.1" });
    expect((await rows()).map((x) => x.number).sort()).toEqual(["V-2026-0001", "V-2026-0002"]);
  });

  it("sends the parish one mail and each parent a confirmation", async () => {
    const r = await submitEnrolment(valid(), { ip: "1.1.1.1" });
    expect(r).toMatchObject({ ok: true, message: "Hvala, vpis je oddan. Potrdilo smo poslali na marko@example.com in ana@example.com. Številka vpisa je V-2026-0001." });
    const mails = devOutbox();
    expect(mails).toHaveLength(3);
    const parish = mails.filter((m) => m.to === PARISH);
    expect(parish.map((m) => m.subject)).toEqual(["Vpis k verouku: Žiga Kralj, 4. razred"]);
    const confirm = mails.filter((m) => m.subject === "Potrdilo o vpisu k verouku");
    expect(confirm.map((m) => m.to).sort()).toEqual(["ana@example.com", "marko@example.com"]);
    for (const m of confirm) expect(m.text).toContain("V-2026-0001");
  });

  it("keeps the parents for 'Dodaj še enega otroka' and works with one parent only", async () => {
    const r = await submitEnrolment(valid(), { ip: "1.1.1.1" });
    expect(r.ok && r.values).toMatchObject({ fatherName: "Marko Kralj", motherEmail: "ana@example.com", address: "Cesta v Zbilje 1, 1215 Medvode" });
    expect(r.ok && r.values && "childFirstName" in r.values).toBe(false);

    clearDevOutbox();
    const one = { ...valid(), fatherName: "", fatherEmail: "", fatherPhone: "" };
    expect((await submitEnrolment(one, { ip: "1.1.1.1" })).ok).toBe(true);
    expect(devOutbox().map((m) => m.to).sort()).toEqual(["ana@example.com", PARISH]);
  });

  it("names the wrong fields and stores nothing", async () => {
    const r = await submitEnrolment({ ...valid(), childFirstName: "" }, { ip: "1.1.1.1" });
    expect(r).toMatchObject({ ok: false, fieldErrors: { childFirstName: "Vpišite ime otroka." } });
    const future = await submitEnrolment({ ...valid(), birthDate: "2027-01-01" }, { ip: "1.1.1.1" });
    expect(future).toMatchObject({ ok: false, fieldErrors: { birthDate: "Datum rojstva ni pravilen." } });
    const rules = await submitEnrolment({ ...valid(), rules: "" }, { ip: "1.1.1.1" });
    expect(rules).toMatchObject({ ok: false, fieldErrors: { rules: "Za vpis potrdite pravila veroučne šole." } });
    const noParent = await submitEnrolment({ ...valid(), fatherName: "", fatherEmail: "", fatherPhone: "", motherName: "", motherEmail: "", motherPhone: "" }, { ip: "1.1.1.1" });
    expect(noParent).toMatchObject({ ok: false, fieldErrors: { motherName: "Vpišite podatke vsaj enega od staršev." } });
    expect(await rows()).toHaveLength(0);
    expect(devOutbox()).toHaveLength(0);
  });

  it("is closed when verouk.enrolmentOpen is false: 409, nothing stored", async () => {
    await db.insert(schema.appSettings).values({ key: "verouk.enrolmentOpen", value: "false" });
    expect(await isEnrolmentOpen()).toBe(false);
    const r = await submitEnrolment(valid(), { ip: "1.1.1.1" });
    expect(r).toEqual({ ok: false, status: 409, message: "Vpisi za šolsko leto 2026/27 so zaprti.", fieldErrors: {} });
    expect(await rows()).toHaveLength(0);
  });

  it("the Verouk area opens and closes enrolment through the engine, with undo", async () => {
    const ana = (await loadActor(db, "ana")) as Actor;
    const tone = (await loadActor(db, "tone")) as Actor;
    const res = await perform(ana, "enrolment.setOpen", { open: false });
    expect(await isEnrolmentOpen()).toBe(false);
    await expect(perform(tone, "enrolment.setOpen", { open: true })).rejects.toThrow("forbidden");
    await undo(ana, (res as { historyId: number }).historyId);
    expect(await isEnrolmentOpen()).toBe(true);
    expect(await db.select().from(schema.appSettings).where(eq(schema.appSettings.key, "verouk.enrolmentOpen"))).toHaveLength(0);
  });

  it("exports CSV whose first data row has the child's name", async () => {
    await submitEnrolment(valid(), { ip: "1.1.1.1" });
    const list = await listEnrolments();
    expect(list[0]).toMatchObject({ childName: "Žiga Kralj", grade: 4, group: "4.–6. razred" });
    const csv = enrolmentsCsv(list);
    const lines = csv.replace(/^﻿/, "").split("\r\n");
    expect(lines[0].split(";").slice(0, 6)).toEqual(["Številka", "Oddano", "Šolsko leto", "Razred", "Skupina", "Ime otroka"]);
    expect(lines[1]).toContain("Žiga");
    expect(lines[1]).toContain("Kralj");
  });

  it("school year turns in June", () => {
    expect(schoolYear(new Date("2026-10-28T12:00:00Z"))).toBe("2026/2027");
    expect(schoolYear(new Date("2027-03-01T12:00:00Z"))).toBe("2026/2027");
    expect(schoolYear(new Date("2027-06-01T12:00:00Z"))).toBe("2027/2028");
  });
});
