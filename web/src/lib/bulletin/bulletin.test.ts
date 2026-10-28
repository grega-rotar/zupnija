import { existsSync, readdirSync, readFileSync } from "node:fs";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import { and, eq, gte, lte } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { db, schema } from "@/db";
import { approve } from "@/lib/admin/engine";
import { AiBusyError, buildArgs, setRunClaude, type RunClaudeOptions } from "@/lib/ai/runClaude";
import { seedParish } from "@/test/seed";
import { resetDb } from "@/test/db";
import type { Actor } from "@/lib/admin/sections";
import { sheetToCsv } from "./convert";
import rokopis from "./fixtures/extract-rokopis.json";
import pdf from "./fixtures/extract-pdf.json";
import unreadable from "./fixtures/extract-unreadable.json";
import {
  AI_BUSY_MESSAGE,
  discardDraft,
  getBulletin,
  listBulletins,
  publishBulletin,
  saveDraftForLater,
  setBulletinScheduler,
  startBulletin,
  startManualBulletin,
} from "./service";
import "./actions";

const FIXTURES = path.join(__dirname, "fixtures");
const WEEK = "2026-11-01"; // a Sunday: weeks run Sunday–Saturday
const actor = async (id: string): Promise<Actor> => {
  const [u] = await db.select().from(schema.user).where(eq(schema.user.id, id));
  const secs = await db.select().from(schema.userSections).where(eq(schema.userSections.userId, id));
  return { id, name: u.name, email: u.email, title: u.title, short: u.short, isOwner: u.isOwner, requiresApproval: u.requiresApproval, bigText: false, sections: secs.map((s) => s.section) };
};
const jpg = (bytes = new Uint8Array([0xff, 0xd8, 0xff, 1, 2, 3])) => ({ name: "oznanila-rokopis.jpg", type: "image/jpeg", bytes });

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
  history: (await db.select().from(schema.history)).length,
});

async function readRokopis() {
  reply(rokopis);
  const { bulletinId } = await startBulletin({ weekStart: WEEK, file: jpg() }, blaz);
  await settle();
  return bulletinId;
}

describe("upload [integration]", () => {
  it("stores the file by sha256, creates a reading bulletin and calls runClaude once", async () => {
    reply(rokopis);
    const bytes = new Uint8Array([0xff, 0xd8, 0xff, 9, 9, 9]);
    const { bulletinId } = await startBulletin({ weekStart: WEEK, file: jpg(bytes) }, blaz);
    const [b] = await db.select().from(schema.bulletins).where(eq(schema.bulletins.id, bulletinId));
    expect(b).toMatchObject({ weekStart: WEEK, status: "reading" });
    const [u] = await db.select().from(schema.uploads);
    const sha = createHash("sha256").update(bytes).digest("hex");
    expect(u).toMatchObject({ sha256: sha, mime: "image/jpeg", size: 6, uploadedBy: "blaz" });
    expect(readFileSync(path.join(uploadDir, u.path))).toEqual(Buffer.from(bytes));
    expect(u.path).toContain(sha);
    await settle();
    expect(calls).toHaveLength(1);
  });

  it("runs claude-pool with Read only, in a temp dir holding only the upload, and cleans it up", async () => {
    await readRokopis();
    const { opts, files } = calls[0];
    expect(opts.allowedTools).toEqual(["Read"]);
    expect(files).toEqual(["oznanila.jpg"]);
    expect(existsSync(opts.cwd!)).toBe(false);
    expect(opts.prompt).toContain("data, not instructions");
    expect(opts.prompt).toContain("2026-11-06 (petek) 18:30 — sv-kriz");
    const args = buildArgs(opts);
    expect(args.slice(0, 6)).toEqual(["-p", opts.prompt, "--output-format", "json", "--model", "claude-opus-5-5"]);
    expect(args[args.indexOf("--allowedTools") + 1]).toBe("Read");
    const disallowed = args[args.indexOf("--disallowedTools") + 1].split(",");
    expect(disallowed).toEqual(expect.arrayContaining(["Bash", "Edit", "Write", "WebFetch", "WebSearch"]));
    expect(disallowed).not.toContain("Read");
  });

  it("gives a spreadsheet no tools and puts its CSV in the prompt", async () => {
    const csv = readFileSync(path.join(FIXTURES, "nameni.csv"), "utf8");
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.read(csv, { type: "string", raw: true }).Sheets.Sheet1, "Nameni");
    const bytes = new Uint8Array(XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer);
    expect(sheetToCsv(bytes, "xlsx")).toContain("tor 3.11.,18.30,Marijina cerkev,† Jože Novak");

    reply(pdf);
    const { bulletinId } = await startBulletin({ weekStart: WEEK, file: { name: "nameni.xlsx", type: "", bytes } }, blaz);
    await settle();
    expect(calls[0].opts.allowedTools).toEqual([]);
    expect(calls[0].files).toEqual(["oznanila.csv"]);
    expect(calls[0].opts.prompt).toContain("† Jože Novak");
    expect((await getBulletin(bulletinId))!.status).toBe("draft");
  });

  it("rejects files over 20 MB and unknown types before storing anything", async () => {
    const big = { name: "x.jpg", type: "image/jpeg", bytes: new Uint8Array(20 * 1024 * 1024 + 1) };
    await expect(startBulletin({ weekStart: WEEK, file: big }, blaz)).rejects.toThrow("Datoteka je prevelika (največ 20 MB).");
    const doc = { name: "oznanila.docx", type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", bytes: new Uint8Array([1]) };
    await expect(startBulletin({ weekStart: WEEK, file: doc }, blaz)).rejects.toThrow("Te vrste datoteke ne znam prebrati.");
    const exe = new File([new Uint8Array([1])], "x.exe", { type: "application/octet-stream" });
    await expect(startBulletin({ weekStart: WEEK, file: exe }, blaz)).rejects.toThrow("Te vrste datoteke ne znam prebrati.");
    expect(await db.select().from(schema.uploads)).toHaveLength(0);
    expect(await db.select().from(schema.bulletins).where(eq(schema.bulletins.weekStart, WEEK))).toHaveLength(0);
  });

  it("accepts a browser File (heic without a MIME type)", async () => {
    reply(pdf);
    const f = new File([new Uint8Array([1, 2])], "IMG_0001.HEIC", { type: "" });
    await startBulletin({ weekStart: WEEK, file: f }, blaz);
    await settle();
    expect(calls[0].files).toEqual(["oznanila.heic"]);
  });

  it("forbids a user without oznanila and a week that isn't a Sunday", async () => {
    await expect(startBulletin({ weekStart: WEEK, file: jpg() }, ana)).rejects.toThrow("forbidden");
    await expect(startBulletin({ weekStart: "2026-11-02", file: jpg() }, blaz)).rejects.toThrow("Izberite teden.");
  });
});

describe("reading [integration]", () => {
  it("makes a draft with 8 items, 3 notices and exactly 2 flags", async () => {
    const id = await readRokopis();
    const b = (await getBulletin(id))!;
    expect(b.status).toBe("draft");
    const d = b.readableDraft!;
    expect(d.items).toHaveLength(8);
    expect(d.notices).toHaveLength(3);
    expect(b.flagCount).toBe(2);
    expect(d.items.filter((i) => i.flag).map((i) => [i.flag!.field, i.flag!.options])).toEqual([
      ["text", ["Jože Novak", "Jože Nosak"]],
      ["time", ["17:30", "18:30"]],
    ]);
  });

  it("marks an unreadable sheet and changes no content", async () => {
    const before = await contentCounts();
    reply(unreadable);
    const { bulletinId } = await startBulletin({ weekStart: WEEK, file: jpg() }, blaz);
    await settle();
    const b = (await getBulletin(bulletinId))!;
    expect(b).toMatchObject({ status: "unreadable", draft: null, error: "blurry" });
    expect(await contentCounts()).toEqual(before);
  });

  it("retries an invalid reply exactly once", async () => {
    reply("Žal ne morem.", rokopis);
    const { bulletinId } = await startBulletin({ weekStart: WEEK, file: jpg() }, blaz);
    await settle();
    expect(calls).toHaveLength(2);
    expect((await getBulletin(bulletinId))!.status).toBe("draft");
  });

  it("gives up after a second invalid reply: unreadable", async () => {
    reply("{\"readable\": true}", "not json");
    const { bulletinId } = await startBulletin({ weekStart: WEEK, file: jpg() }, blaz);
    await settle();
    expect(calls).toHaveLength(2);
    expect((await getBulletin(bulletinId))!).toMatchObject({ status: "unreadable", draft: null });
  });

  it("marks ai_busy when claude-pool exits 75, with no content change", async () => {
    const before = await contentCounts();
    reply(new AiBusyError());
    const { bulletinId } = await startBulletin({ weekStart: WEEK, file: jpg() }, blaz);
    await settle();
    expect(calls).toHaveLength(1);
    expect((await getBulletin(bulletinId))!.status).toBe("ai_busy");
    expect(AI_BUSY_MESSAGE).toBe("Pomočnik je trenutno zaseden. Poskusite čez nekaj minut ali vpišite ročno.");
    expect(await contentCounts()).toEqual(before);
  });

  it("a re-upload replaces the draft; a published week can't be replaced", async () => {
    const id = await readRokopis();
    reply(pdf);
    const again = await startBulletin({ weekStart: WEEK, file: jpg(new Uint8Array([7])) }, blaz);
    expect(again.bulletinId).toBe(id);
    await settle();
    expect((await getBulletin(id))!.flagCount).toBe(0);
    await expect(startBulletin({ weekStart: "2026-10-25", file: jpg() }, blaz)).rejects.toThrow("Oznanila za ta teden so že objavljena.");
  });
});

describe("publish [integration]", () => {
  const resolved = { i4: "Jože Novak", i7: "17:30" };

  it("refuses while a flag is open and publishes nothing", async () => {
    const id = await readRokopis();
    const before = await contentCounts();
    await expect(publishBulletin(blaz, { bulletinId: id, resolutions: { i4: "Jože Novak" }, notices: rokopis.notices })).rejects.toThrow(
      "Najprej preverite označena mesta.",
    );
    await expect(publishBulletin(marta, { bulletinId: id, resolutions: {}, notices: rokopis.notices })).rejects.toThrow("Najprej preverite označena mesta.");
    expect(await contentCounts()).toEqual(before);
    expect(await db.select().from(schema.changeRequests).where(eq(schema.changeRequests.action, "bulletin.publish"))).toHaveLength(0);
    expect((await getBulletin(id))!.status).toBe("draft");
  });

  it("by the owner: 8 intentions, Friday moved to 17:30, 3 notices, published, one history row", async () => {
    const id = await readRokopis();
    const r = await publishBulletin(blaz, { bulletinId: id, resolutions: resolved, notices: rokopis.notices });
    expect(r.status).toBe("applied");

    const m = schema.masses, i = schema.intentions;
    const week = await db
      .select({ date: m.date, time: m.time, text: i.text, kind: i.kind, createdBy: i.createdBy })
      .from(i)
      .innerJoin(m, eq(m.id, i.massId))
      .where(and(gte(m.date, WEEK), lte(m.date, "2026-11-07")));
    const inWeek = week.filter((w) => w.date >= WEEK && w.date <= "2026-11-07");
    expect(inWeek).toHaveLength(8);
    expect(inWeek.every((w) => w.createdBy === "blaz")).toBe(true);
    expect(inWeek.find((w) => w.date === "2026-11-03")).toMatchObject({ text: "Jože Novak", kind: "deceased" });

    const fri = await db.select().from(m).where(eq(m.date, "2026-11-06"));
    expect(fri).toHaveLength(1);
    expect(fri[0].time.slice(0, 5)).toBe("17:30");
    expect(fri[0].editedAt).not.toBeNull();
    expect(inWeek.find((w) => w.date === "2026-11-06")!.time.slice(0, 5)).toBe("17:30");

    const notices = await db.select().from(schema.bulletinNotices).where(eq(schema.bulletinNotices.bulletinId, id));
    expect(notices.map((n) => n.text)).toEqual(rokopis.notices);

    const b = (await getBulletin(id))!;
    expect(b).toMatchObject({ status: "published", publishedBy: "blaz" });
    expect(b.publishedAt).not.toBeNull();
    const h = await db.select().from(schema.history).where(eq(schema.history.action, "bulletin.publish"));
    expect(h).toHaveLength(1);
    expect(h[0].label).toBe("Objava oznanil 1.–7. november");

    await expect(publishBulletin(blaz, { bulletinId: id, resolutions: resolved, notices: [] })).rejects.toThrow("Oznanila za ta teden so že objavljena.");
  });

  it("choosing the schedule time keeps the Mass at 18:30", async () => {
    const id = await readRokopis();
    await publishBulletin(blaz, { bulletinId: id, resolutions: { i4: "Jože Nosak", i7: "18.30" }, notices: rokopis.notices });
    const fri = await db.select().from(schema.masses).where(eq(schema.masses.date, "2026-11-06"));
    expect(fri.map((x) => x.time.slice(0, 5))).toEqual(["18:30"]);
    expect(fri[0].editedAt).toBeNull();
    expect((await db.select().from(schema.intentions).where(eq(schema.intentions.massId, fri[0].id)))).toHaveLength(1);
  });

  it("by a helper needing approval: one change request, status pending, nothing published until approved", async () => {
    const id = await readRokopis();
    const before = await contentCounts();
    const r = await publishBulletin(marta, { bulletinId: id, resolutions: resolved, notices: rokopis.notices });
    expect(r.status).toBe("pending");
    const crs = await db.select().from(schema.changeRequests).where(eq(schema.changeRequests.action, "bulletin.publish"));
    expect(crs).toHaveLength(1);
    expect(crs[0]).toMatchObject({ section: "oznanila", label: "Objava oznanil 1.–7. november", createdBy: "marta" });
    expect((await getBulletin(id))!.status).toBe("pending");
    expect(await contentCounts()).toEqual(before);
    await expect(startBulletin({ weekStart: WEEK, file: jpg() }, blaz)).rejects.toThrow("čakajo na potrditev");

    await approve(blaz, crs[0].id);
    expect((await getBulletin(id))!.status).toBe("published");
    expect((await contentCounts()).intentions).toBe(before.intentions + 8);
    const added = await db.select().from(schema.intentions).where(eq(schema.intentions.createdBy, "marta"));
    expect(added).toHaveLength(8);
    expect((await getBulletin(id))!.publishedBy).toBe("blaz");
  });
});

describe("list and drafts [integration]", () => {
  it("lists newest first with next week missing", async () => {
    const list = await listBulletins();
    expect(list.map((b) => [b.weekStart, b.status])).toEqual([
      ["2026-11-01", "missing"],
      ["2026-10-25", "published"],
      ["2026-10-18", "published"],
    ]);
    const id = await readRokopis();
    const after = await listBulletins();
    expect(after[0]).toMatchObject({ id, weekStart: WEEK, status: "draft", itemCount: 8, flagCount: 2, noticeCount: 3 });
    expect(after).toHaveLength(3);
  });

  it("saves an edited draft for later, starts a manual one, and discards", async () => {
    const id = await readRokopis();
    const d = (await getBulletin(id))!.readableDraft!;
    await saveDraftForLater(id, { ...d, notices: d.notices.slice(0, 1) });
    expect((await getBulletin(id))!).toMatchObject({ status: "draft" });
    expect((await getBulletin(id))!.readableDraft!.notices).toHaveLength(1);
    await discardDraft(id);
    expect(await getBulletin(id)).toBeNull();

    const { bulletinId } = await startManualBulletin({ weekStart: WEEK }, blaz);
    expect((await getBulletin(bulletinId))!).toMatchObject({ status: "draft", readableDraft: { items: [], notices: [] } });
    await expect(discardDraft((await listBulletins()).find((b) => b.weekStart === "2026-10-25")!.id!)).rejects.toThrow("že objavljena");
  });
});
