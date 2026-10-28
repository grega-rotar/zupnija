import { existsSync, readdirSync, readFileSync } from "node:fs";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import { and, eq, gte, lte } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { db, schema } from "@/db";
import { approve, undo } from "@/lib/admin/engine";
import { AiBusyError, buildArgs, setRunClaude, type RunClaudeOptions } from "@/lib/ai/runClaude";
import { seedParish } from "@/test/seed";
import { resetDb } from "@/test/db";
import type { Actor } from "@/lib/admin/sections";
import { sheetToCsv } from "./convert";
import oktober from "./fixtures/extract-oktober-2026.json";
import rokopis from "./fixtures/extract-rokopis.json";
import pdf from "./fixtures/extract-pdf.json";
import unreadable from "./fixtures/extract-unreadable.json";
import { DEFAULT_READING_HINTS, getReadingHints, setReadingHints } from "./hints";
import {
  AI_BUSY_MESSAGE,
  discardDraft,
  getBulletin,
  listBulletins,
  nextMissingPeriod,
  publishBulletin,
  saveDraftForLater,
  setBulletinScheduler,
  startBulletin,
  startManualBulletin,
} from "./service";
import { allIntentions } from "./types";
import "./actions";

const FIXTURES = path.join(__dirname, "fixtures");
const actor = async (id: string): Promise<Actor> => {
  const [u] = await db.select().from(schema.user).where(eq(schema.user.id, id));
  const secs = await db.select().from(schema.userSections).where(eq(schema.userSections.userId, id));
  return { id, name: u.name, email: u.email, title: u.title, short: u.short, isOwner: u.isOwner, requiresApproval: u.requiresApproval, bigText: false, sections: secs.map((s) => s.section) };
};
const jpg = (bytes = new Uint8Array([0xff, 0xd8, 0xff, 1, 2, 3])) => ({ name: "oznanila-rokopis.jpg", type: "image/jpeg", bytes });
const pdfFile = (bytes = new Uint8Array([0x25, 0x50, 0x44, 0x46, 1])) => ({ name: "oznanila-oktober-2026.pdf", type: "application/pdf", bytes });

// ── runClaude mock and background runner ───────────────────────────────────
let calls: { opts: RunClaudeOptions; files: string[] }[] = [];
let replies: (string | Error)[] = [];
let jobs: Promise<void>[] = [];
function reply(...r: (string | object | Error)[]) {
  replies = r.map((x) => (typeof x === "string" || x instanceof Error ? x : JSON.stringify(x)));
}
const settle = async () => {
  await Promise.all(jobs);
  jobs = [];
};
let uploadDir = "";

beforeAll(() => {
  uploadDir = mkdtempSync(path.join(os.tmpdir(), "zupnija-uploads-"));
  process.env.UPLOAD_DIR = uploadDir;
  setRunClaude(async (opts) => {
    calls.push({ opts, files: opts.cwd ? readdirSync(opts.cwd) : [] });
    const r = replies.shift();
    if (r === undefined) throw new Error("unexpected runClaude call");
    if (r instanceof Error) throw r;
    return { text: r, durationMs: 1, account: "test" };
  });
  setBulletinScheduler((task) => void jobs.push(task()));
});
afterAll(() => {
  setRunClaude(null);
  rmSync(uploadDir, { recursive: true, force: true });
});

let blaz: Actor, marta: Actor, ana: Actor;
beforeEach(async () => {
  await resetDb();
  await seedParish(db);
  [blaz, marta, ana] = await Promise.all([actor("blaz"), actor("marta"), actor("ana")]);
  calls = [];
  replies = [];
  jobs = [];
});
afterEach(settle);

const contentCounts = async () => ({
  intentions: (await db.select().from(schema.intentions)).length,
  notices: (await db.select().from(schema.bulletinNotices)).length,
  masses: (await db.select().from(schema.masses)).length,
  events: (await db.select().from(schema.events)).length,
  days: (await db.select().from(schema.calendarDays)).length,
  history: (await db.select().from(schema.history)).length,
});

async function readFixture(fixture: object, file: { name: string; type: string; bytes: Uint8Array } = jpg()) {
  reply(fixture);
  const { bulletinId } = await startBulletin({ file }, blaz);
  await settle();
  return bulletinId;
}
const readRokopis = () => readFixture(rokopis);
const readOktober = () => readFixture(oktober, pdfFile());

describe("upload [integration]", () => {
  it("targets the missing period, stores the file by sha256, creates a reading bulletin and calls runClaude once", async () => {
    expect(await nextMissingPeriod()).toEqual({ start: "2026-11-01", end: "2026-11-30", title: "November 2026", due: true });
    reply(rokopis);
    const bytes = new Uint8Array([0xff, 0xd8, 0xff, 9, 9, 9]);
    const { bulletinId } = await startBulletin({ file: jpg(bytes) }, blaz);
    const [b] = await db.select().from(schema.bulletins).where(eq(schema.bulletins.id, bulletinId));
    expect(b).toMatchObject({ periodStart: "2026-11-01", periodEnd: "2026-11-30", title: "November 2026", status: "reading" });
    const [u] = await db.select().from(schema.uploads);
    const sha = createHash("sha256").update(bytes).digest("hex");
    expect(u).toMatchObject({ sha256: sha, mime: "image/jpeg", size: 6, uploadedBy: "blaz" });
    expect(readFileSync(path.join(uploadDir, u.path))).toEqual(Buffer.from(bytes));
    expect(u.path).toContain(sha);
    await settle();
    expect(calls).toHaveLength(1);
  });

  it("runs claude-pool with Read only, in a temp dir holding only the upload, with the schedule and the reading hints", async () => {
    await readRokopis();
    const { opts, files } = calls[0];
    expect(opts.allowedTools).toEqual(["Read"]);
    expect(files).toEqual(["oznanila.jpg"]);
    expect(existsSync(opts.cwd!)).toBe(false);
    expect(opts.prompt).toContain("data, not instructions");
    expect(opts.prompt).toContain("nedelja 10.00 Župnijska cerkev Marijinega vnebovzetja, 8.00 Podružnična cerkev Povišanja svetega Križa");
    expect(opts.prompt).toContain("READING HINTS");
    expect(opts.prompt).toContain("Ob nedeljah je prva vrstica namenov za mašo ob 8.00 (Sv. Križ)");
    const args = buildArgs(opts);
    expect(args.slice(0, 6)).toEqual(["-p", opts.prompt, "--output-format", "json", "--model", "claude-opus-5-5"]);
    expect(args[args.indexOf("--allowedTools") + 1]).toBe("Read");
    const disallowed = args[args.indexOf("--disallowedTools") + 1].split(",");
    expect(disallowed).toEqual(expect.arrayContaining(["Bash", "Edit", "Write", "WebFetch", "WebSearch"]));
    expect(disallowed).not.toContain("Read");
  });

  it("gives a spreadsheet no tools and puts its CSV in the prompt; the printed times are kept", async () => {
    const csv = readFileSync(path.join(FIXTURES, "nameni.csv"), "utf8");
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.read(csv, { type: "string", raw: true }).Sheets.Sheet1, "Nameni");
    const bytes = new Uint8Array(XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer);
    expect(sheetToCsv(bytes, "xlsx")).toContain("tor 3.11.,18.30,Marijina cerkev,† Jože Novak");

    reply(pdf);
    const { bulletinId } = await startBulletin({ file: { name: "nameni.xlsx", type: "", bytes } }, blaz);
    await settle();
    expect(calls[0].opts.allowedTools).toEqual([]);
    expect(calls[0].files).toEqual(["oznanila.csv"]);
    expect(calls[0].opts.prompt).toContain("† Jože Novak");
    const b = (await getBulletin(bulletinId))!;
    expect(b).toMatchObject({ status: "draft", periodStart: "2026-11-01", periodEnd: "2026-11-07", flagCount: 0 });
    expect(allIntentions(b.readableDraft!).map((i) => `${i.date} ${i.time} ${i.churchSlug}`)).toContain("2026-11-05 07:00 marijino-vnebovzetje");
  });

  it("rejects files over 20 MB and unknown types before storing anything", async () => {
    const big = { name: "x.jpg", type: "image/jpeg", bytes: new Uint8Array(20 * 1024 * 1024 + 1) };
    await expect(startBulletin({ file: big }, blaz)).rejects.toThrow("Datoteka je prevelika (največ 20 MB).");
    const doc = { name: "oznanila.docx", type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", bytes: new Uint8Array([1]) };
    await expect(startBulletin({ file: doc }, blaz)).rejects.toThrow("Te vrste datoteke ne znam prebrati.");
    const exe = new File([new Uint8Array([1])], "x.exe", { type: "application/octet-stream" });
    await expect(startBulletin({ file: exe }, blaz)).rejects.toThrow("Te vrste datoteke ne znam prebrati.");
    expect(await db.select().from(schema.uploads)).toHaveLength(0);
    expect(await db.select().from(schema.bulletins)).toHaveLength(2);
  });

  it("accepts a browser File (heic without a MIME type)", async () => {
    reply(pdf);
    const f = new File([new Uint8Array([1, 2])], "IMG_0001.HEIC", { type: "" });
    await startBulletin({ file: f }, blaz);
    await settle();
    expect(calls[0].files).toEqual(["oznanila.heic"]);
  });

  it("forbids a user without oznanila and a bad period", async () => {
    await expect(startBulletin({ file: jpg() }, ana)).rejects.toThrow("forbidden");
    await expect(startBulletin({ periodStart: "2026-11-xx", file: jpg() }, blaz)).rejects.toThrow("Izberite obdobje.");
    await expect(startBulletin({ periodStart: "2026-11-10", periodEnd: "2026-11-01", file: jpg() }, blaz)).rejects.toThrow("Izberite obdobje.");
  });
});

describe("reading [integration]", () => {
  it("the handwritten weekly sheet: the document's week wins, 8 intentions, 3 notices, 3 flags", async () => {
    const id = await readRokopis();
    const b = (await getBulletin(id))!;
    expect(b).toMatchObject({ status: "draft", periodStart: "2026-11-01", periodEnd: "2026-11-07", title: "Teden 1.–7. november 2026" });
    const d = b.readableDraft!;
    expect(allIntentions(d)).toHaveLength(8);
    expect(d.notices).toHaveLength(3);
    expect(b.flagCount).toBe(3);
    expect(allIntentions(d).filter((i) => i.flag).map((i) => [i.id, i.flag!.field, i.flag!.options])).toEqual([
      ["i4", "text", ["Jože Novak", "Jože Nosak"]],
      ["i7", "time", ["17:30", "18:30"]],
    ]);
    expect(d.events[0]).toMatchObject({ id: "e1", flag: { field: "time" } });
  });

  it("the October booklet uploaded while November is expected becomes October's bulletin", async () => {
    const id = await readOktober();
    const b = (await getBulletin(id))!;
    expect(b).toMatchObject({ status: "draft", periodStart: "2026-10-01", periodEnd: "2026-10-31", title: "Oktober 2026", issue: "Leto XLII, številka 10", flagCount: 0 });
    expect(b.readableDraft!.days).toHaveLength(31);
    expect(b.upload).toMatchObject({ mime: "application/pdf" });
    expect(calls[0].files).toEqual(["oznanila.pdf"]);
  });

  it("a document for a period that already has a bulletin is reported, not merged", async () => {
    await db.insert(schema.bulletins).values({ periodStart: "2026-10-01", periodEnd: "2026-10-31", title: "Oktober 2026", status: "published" });
    const id = await readOktober();
    expect((await getBulletin(id))!).toMatchObject({ status: "unreadable", draft: null, error: "other_period:Oktober 2026", periodStart: "2026-11-01" });
  });

  it("marks an unreadable sheet and changes no content", async () => {
    const before = await contentCounts();
    const id = await readFixture(unreadable);
    expect((await getBulletin(id))!).toMatchObject({ status: "unreadable", draft: null, error: "blurry" });
    expect(await contentCounts()).toEqual(before);
  });

  it("retries an invalid reply exactly once", async () => {
    reply("Žal ne morem.", rokopis);
    const { bulletinId } = await startBulletin({ file: jpg() }, blaz);
    await settle();
    expect(calls).toHaveLength(2);
    expect((await getBulletin(bulletinId))!.status).toBe("draft");
  });

  it("gives up after a second invalid reply: unreadable", async () => {
    reply("{\"days\": []}", "not json");
    const { bulletinId } = await startBulletin({ file: jpg() }, blaz);
    await settle();
    expect(calls).toHaveLength(2);
    expect((await getBulletin(bulletinId))!).toMatchObject({ status: "unreadable", draft: null });
  });

  it("marks ai_busy when claude-pool exits 75, with no content change", async () => {
    const before = await contentCounts();
    reply(new AiBusyError());
    const { bulletinId } = await startBulletin({ file: jpg() }, blaz);
    await settle();
    expect(calls).toHaveLength(1);
    expect((await getBulletin(bulletinId))!.status).toBe("ai_busy");
    expect(AI_BUSY_MESSAGE).toBe("Pomočnik je trenutno zaseden. Poskusite čez nekaj minut ali vpišite ročno.");
    expect(await contentCounts()).toEqual(before);
  });

  it("a re-upload replaces the draft; a published period can't be replaced", async () => {
    const id = await readRokopis();
    reply(pdf);
    const again = await startBulletin({ periodStart: "2026-11-01", file: jpg(new Uint8Array([7])) }, blaz);
    expect(again.bulletinId).toBe(id);
    await settle();
    expect((await getBulletin(id))!.flagCount).toBe(0);
    await expect(startBulletin({ periodStart: "2026-10-25", file: jpg() }, blaz)).rejects.toThrow("Ta oznanila so že objavljena.");
  });
});

describe("publish [integration]", () => {
  const resolved = { i4: "Jože Novak", i7: "17:30", e1: "07:45" };

  it("refuses while a flag is open (an intention or an included event) and publishes nothing", async () => {
    const id = await readRokopis();
    const before = await contentCounts();
    await expect(publishBulletin(blaz, { bulletinId: id, resolutions: { i4: "Jože Novak", i7: "18:30" } })).rejects.toThrow("Najprej preverite označena mesta.");
    await expect(publishBulletin(marta, { bulletinId: id, resolutions: {} })).rejects.toThrow("Najprej preverite označena mesta.");
    expect(await contentCounts()).toEqual(before);
    expect(await db.select().from(schema.changeRequests).where(eq(schema.changeRequests.action, "bulletin.publish"))).toHaveLength(0);
    expect((await getBulletin(id))!.status).toBe("draft");
  });

  it("by the owner (weekly sheet): 8 intentions, Friday moved to 17:30, 3 notices, the event, one history row", async () => {
    const id = await readRokopis();
    const r = await publishBulletin(blaz, { bulletinId: id, resolutions: resolved });
    expect(r).toMatchObject({ status: "applied", result: { intentions: 8, skipped: 0, notices: 3, events: 1 } });

    const m = schema.masses, i = schema.intentions;
    const week = await db
      .select({ date: m.date, time: m.time, text: i.text, kind: i.kind, createdBy: i.createdBy })
      .from(i)
      .innerJoin(m, eq(m.id, i.massId))
      .where(and(gte(m.date, "2026-11-01"), lte(m.date, "2026-11-07")));
    expect(week).toHaveLength(8);
    expect(week.every((w) => w.createdBy === "blaz")).toBe(true);
    expect(week.find((w) => w.date === "2026-11-03")).toMatchObject({ text: "Jože Novak", kind: "deceased" });

    const fri = await db.select().from(m).where(eq(m.date, "2026-11-06"));
    expect(fri).toHaveLength(1);
    expect(fri[0].time.slice(0, 5)).toBe("17:30");
    expect(fri[0].editedAt).not.toBeNull();

    const notices = await db.select().from(schema.bulletinNotices).where(eq(schema.bulletinNotices.bulletinId, id));
    expect(notices.map((n) => n.text)).toEqual(rokopis.notices.map((n) => n.text));
    const [ev] = await db.select().from(schema.events).where(eq(schema.events.sourceBulletinId, id));
    expect(ev).toMatchObject({ title: "Srečanje ključarjev", date: "2026-11-05", time: "07:45:00", place: "župnišče" });

    const b = (await getBulletin(id))!;
    expect(b).toMatchObject({ status: "published", publishedBy: "blaz" });
    const h = await db.select().from(schema.history).where(eq(schema.history.action, "bulletin.publish"));
    expect(h).toHaveLength(1);
    expect(h[0].label).toBe("Objava oznanil za 1.–7. november 2026");
    await expect(publishBulletin(blaz, { bulletinId: id, resolutions: resolved })).rejects.toThrow("Ta oznanila so že objavljena.");
  });

  it("choosing the schedule time keeps the Mass at 18:30", async () => {
    const id = await readRokopis();
    await publishBulletin(blaz, { bulletinId: id, resolutions: { ...resolved, i4: "Jože Nosak", i7: "18.30" } });
    const fri = await db.select().from(schema.masses).where(eq(schema.masses.date, "2026-11-06"));
    expect(fri.map((x) => x.time.slice(0, 5))).toEqual(["18:30"]);
    expect(fri[0].editedAt).toBeNull();
    expect(await db.select().from(schema.intentions).where(eq(schema.intentions.massId, fri[0].id))).toHaveLength(1);
  });

  it("October, published late: the whole month, deduplicated against the 6 imported intentions of 26.–31. 10.", async () => {
    const id = await readOktober();
    // The parish already had this meeting in the calendar, and an old title for 28. 10.
    await db.insert(schema.events).values({ title: "Seja ŽPS", date: "2026-10-06", time: "19:15", place: "Župnišče" });
    await db.insert(schema.calendarDays).values({ date: "2026-10-28", title: "staro" });
    // The priest unticks the pilgrimage before publishing.
    const d = (await getBulletin(id))!.readableDraft!;
    const romanje = d.events.find((e) => e.date === "2026-10-24")!;
    await saveDraftForLater(id, { ...d, events: d.events.map((e) => (e.id === romanje.id ? { ...e, include: false } : e)) });

    const before = await contentCounts();
    const r = await publishBulletin(blaz, { bulletinId: id, resolutions: {} });
    expect(r).toMatchObject({ status: "applied", result: { intentions: 29, skipped: 6, notices: 10, days: 31, events: 5 } });
    const after = await contentCounts();
    expect(after.intentions - before.intentions).toBe(29);

    const m = schema.masses, i = schema.intentions;
    const rows = await db
      .select({ date: m.date, time: m.time, text: i.text })
      .from(i)
      .innerJoin(m, eq(m.id, i.massId))
      .where(and(gte(m.date, "2026-10-01"), lte(m.date, "2026-10-31")));
    expect(rows).toHaveLength(35);
    expect(rows.filter((x) => x.date === "2026-10-29").map((x) => x.text)).toEqual(["v zahvalo"]);
    expect(rows.filter((x) => x.date === "2026-10-11").sort((a, b) => a.time.localeCompare(b.time)).map((x) => `${x.time.slice(0, 5)} ${x.text}`)).toEqual([
      "08:00 Za farane",
      "10:00 Jože Novak, obl.",
    ]);
    expect(rows.filter((x) => x.date === "2026-10-25")).toHaveLength(2);

    const days = await db.select().from(schema.calendarDays);
    expect(days).toHaveLength(31);
    expect(days.find((x) => x.date === "2026-10-28")).toMatchObject({ title: "Simon in Juda Tadej, apostola", bulletinId: id });
    expect(days.find((x) => x.date === "2026-10-11")).toMatchObject({ sundayName: "28. navadna nedelja", gospel: "»Kje pa je onih devet?«" });
    expect(days.find((x) => x.date === "2026-10-03")!.tags).toEqual(["MLADINSKA SK."]);

    const evs = await db.select().from(schema.events).where(eq(schema.events.sourceBulletinId, id));
    expect(evs.map((e) => e.date).sort()).toEqual(["2026-10-14", "2026-10-17", "2026-10-20", "2026-10-21", "2026-10-25"]);

    const b = (await getBulletin(id))!;
    expect(b).toMatchObject({ status: "published", title: "Oktober 2026", issue: "Leto XLII, številka 10", article: { title: "Rožnovenska Mati Božja" }, prayerIntention: { title: "Za duševno zdravje" } });
    expect((await db.select().from(schema.history).where(eq(schema.history.action, "bulletin.publish")))[0].label).toBe("Objava oznanil za oktober 2026");
    expect(await nextMissingPeriod()).toMatchObject({ start: "2026-11-01", title: "November 2026" });
  });

  it("can be undone as a whole", async () => {
    const id = await readOktober();
    const before = await contentCounts();
    const r = await publishBulletin(blaz, { bulletinId: id, resolutions: {} });
    await undo(blaz, (r as { historyId: number }).historyId);
    expect({ ...(await contentCounts()), history: 0 }).toEqual({ ...before, masses: (await contentCounts()).masses, history: 0 });
    expect((await getBulletin(id))!.status).toBe("draft");
  });

  it("by a helper needing approval: one change request, status pending, nothing published until approved", async () => {
    const id = await readRokopis();
    const before = await contentCounts();
    const r = await publishBulletin(marta, { bulletinId: id, resolutions: resolved });
    expect(r.status).toBe("pending");
    const crs = await db.select().from(schema.changeRequests).where(eq(schema.changeRequests.action, "bulletin.publish"));
    expect(crs).toHaveLength(1);
    expect(crs[0]).toMatchObject({ section: "oznanila", label: "Objava oznanil za 1.–7. november 2026", createdBy: "marta" });
    expect((await getBulletin(id))!.status).toBe("pending");
    expect(await contentCounts()).toEqual(before);
    await expect(startBulletin({ periodStart: "2026-11-01", file: jpg() }, blaz)).rejects.toThrow("čakajo na potrditev");
    // A pending bulletin counts as covering its days.
    expect(await nextMissingPeriod()).toMatchObject({ start: "2026-11-08", end: "2026-11-14" });

    await approve(blaz, crs[0].id);
    expect((await getBulletin(id))!.status).toBe("published");
    expect((await contentCounts()).intentions).toBe(before.intentions + 8);
    expect(await db.select().from(schema.intentions).where(eq(schema.intentions.createdBy, "marta"))).toHaveLength(8);
    expect((await getBulletin(id))!.publishedBy).toBe("blaz");
  });
});

describe("list and drafts [integration]", () => {
  it("lists newest first with the missing month", async () => {
    const list = await listBulletins();
    expect(list.map((b) => [b.periodStart, b.title, b.status])).toEqual([
      ["2026-11-01", "November 2026", "missing"],
      ["2026-10-25", "Teden 25. 10.–31. 10. 2026", "published"],
      ["2026-10-18", "Teden 18. 10.–24. 10. 2026", "published"],
    ]);
    const id = await readOktober();
    const after = await listBulletins();
    expect(after.find((b) => b.id === id)).toMatchObject({ periodStart: "2026-10-01", status: "draft", itemCount: 35, flagCount: 0, noticeCount: 10, eventCount: 7 });
    expect(after[0]).toMatchObject({ periodStart: "2026-11-01", status: "missing" });
  });

  it("saves an edited draft for later (period dates stay), starts a manual one, and discards", async () => {
    const id = await readRokopis();
    const d = (await getBulletin(id))!.readableDraft!;
    await saveDraftForLater(id, { ...d, period: { ...d.period, start: "2030-01-01", title: "Prvi teden novembra" }, notices: d.notices.slice(0, 1) });
    const saved = (await getBulletin(id))!;
    expect(saved).toMatchObject({ status: "draft", title: "Prvi teden novembra", periodStart: "2026-11-01" });
    expect(saved.readableDraft!.notices).toHaveLength(1);
    expect(saved.readableDraft!.period.start).toBe("2026-11-01");
    await expect(saveDraftForLater(id, { ...d, days: [...d.days, d.days[0]] })).rejects.toThrow("Osnutek ni veljaven.");
    await discardDraft(id);
    expect(await getBulletin(id)).toBeNull();

    const { bulletinId } = await startManualBulletin({}, blaz);
    expect((await getBulletin(bulletinId))!).toMatchObject({
      status: "draft",
      periodStart: "2026-11-01",
      readableDraft: { period: { start: "2026-11-01", end: "2026-11-30", title: "November 2026" }, days: [], notices: [], events: [] },
    });
    await expect(discardDraft((await listBulletins()).find((b) => b.periodStart === "2026-10-25")!.id!)).rejects.toThrow("že objavljena");
  });
});

describe("reading hints [integration]", () => {
  it("default until the owner saves them; saved hints reach the prompt; history and undo", async () => {
    expect(await getReadingHints()).toBe(DEFAULT_READING_HINTS);
    await expect(setReadingHints(marta, "x")).rejects.toThrow("forbidden");
    const r = await setReadingHints(blaz, "Ob nedeljah: prva vrstica 7.30.");
    expect(await getReadingHints()).toBe("Ob nedeljah: prva vrstica 7.30.");
    const [h] = await db.select().from(schema.history).where(eq(schema.history.action, "settings.readingHints"));
    expect(h).toMatchObject({ section: "oznanila", label: "Navodila za branje oznanil", userId: "blaz" });

    await readRokopis();
    expect(calls[0].opts.prompt).toContain("Ob nedeljah: prva vrstica 7.30.");
    expect(calls[0].opts.prompt).not.toContain("Ob nedeljah je prva vrstica namenov");

    await undo(blaz, (r as { historyId: number }).historyId);
    expect(await getReadingHints()).toBe(DEFAULT_READING_HINTS);
  });
});
