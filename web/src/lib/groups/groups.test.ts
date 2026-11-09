/**
 * Groups (ZUP-13, ZUP-23, ZUP-25): the real groups imported from the fixture,
 * then migration 0004_groups_zup13 on top, as on the live site; and the
 * anonymous prayer request.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import postgres from "postgres";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { db, schema } from "@/db";
import * as data from "@/sanity/data";
import { PRAYER_EMAIL_DEFAULT, TYPES } from "@/lib/content/fields";
import { CHECK_FIELDS, TOO_MANY } from "@/lib/forms/public";
import { clearDevOutbox, devOutbox } from "@/lib/mail";
import { resetDb } from "@/test/db";
import exportFixture from "@/test/fixtures/sanity-export.json";
import { PRAYER_SUBJECT, PRAYER_THANKS, prayerMailText, submitPrayerRequest } from "./prayerRequest";
import { importContent } from "../../../scripts/import-sanity-content-lib.mjs";

const sql = postgres(process.env.DATABASE_URL!, { max: 1, onnotice: () => {} });
const MIGRATION = readFileSync(path.join(__dirname, "../../../drizzle/0004_groups_zup13.sql"), "utf8");

async function importAndMigrate() {
  await resetDb();
  await importContent(sql, exportFixture as never, { store: async (a: { size?: number }) => ({ sha256: "0".repeat(64), size: a.size ?? 0 }) });
  for (const statement of MIGRATION.split("--> statement-breakpoint")) await sql.unsafe(statement);
}

/** Row counts of every table but the rate limit's: a prayer request must leave them all as they were. */
async function tableCounts(): Promise<Record<string, number>> {
  const tables = await sql<{ tablename: string }[]>`select tablename from pg_tables where schemaname = 'public' and tablename <> 'rate_limit_hits'`;
  const out: Record<string, number> = {};
  for (const { tablename } of tables) out[tablename] = Number((await sql.unsafe(`select count(*) from "${tablename}"`))[0].count);
  return out;
}

afterAll(async () => {
  await sql.end();
});

describe("groups page (ZUP-13)", () => {
  beforeAll(importAndMigrate);

  it("lists the 16 groups in the agreed order, each with its icon", async () => {
    const groups = await data.getGroups();
    expect(groups.map((g) => g.title)).toEqual([
      "Župnijski pastoralni svet (ŽPS)",
      "Župnijska Karitas Pirniče",
      "Molitvena skupina",
      "Prva zakonska skupina",
      "Druga zakonska skupina",
      "Mladinska skupina",
      "Ministranti",
      "Bralci Božje besede",
      "Pritrkovalci",
      "Mladinski pevski zbor",
      "Otroški pevski zbor",
      "Odrasli pevski zbor",
      "Krasilci",
      "Oratorijski animatorji",
      "Verouk",
      "Oratorij",
    ]);
    const icons = TYPES.parishGroup.fields.find((f) => f.name === "icon");
    const known = icons?.kind === "select" ? icons.options.map((o) => o.value) : [];
    for (const g of groups) expect(known).toContain(g.icon);
    // Both marriage groups share one icon.
    expect(groups.filter((g) => g.icon === "zakonska-skupina").map((g) => g.slug)).toEqual(["prva-zakonska-skupina", "druga-zakonska-skupina"]);
  });

  it("the Verouk card leads to /verouk; the others to their own pages", async () => {
    const groups = await data.getGroups();
    expect(groups.find((g) => g.slug === "verouk")?.href).toBe("/verouk");
    expect(groups.filter((g) => g.href).map((g) => g.slug)).toEqual(["verouk"]);
    expect(TYPES.parishGroup.publicPath?.({ slug: { current: "verouk" }, href: "/verouk" })).toBe("/verouk");
    expect(TYPES.parishGroup.publicPath?.({ slug: { current: "ministranti" } })).toBe("/zupnija/skupine/ministranti");
  });

  it("a new group's page shows its name, icon and 'vsebina'; existing pages keep their text", async () => {
    const g = await data.getGroup("ministranti");
    expect(g).toMatchObject({ title: "Ministranti", icon: "ministranti", hideJoin: false, prayerRequests: false });
    expect(g?.description).toMatchObject([{ _type: "block", children: [{ text: "vsebina" }] }]);
    const zps = await data.getGroup("zupnijski-pastoralni-svet");
    expect(zps?.description?.length).toBeGreaterThan(0);
    expect(JSON.stringify(zps?.description)).not.toContain('"vsebina"');
  });

  it("running the migration again changes nothing", async () => {
    const before = await sql`select id, data, sort from content where type = 'parishGroup' order by id`;
    for (const statement of MIGRATION.split("--> statement-breakpoint")) await sql.unsafe(statement);
    expect(await sql`select id, data, sort from content where type = 'parishGroup' order by id`).toEqual(before);
  });

  it("adds nothing to an empty database (the import still runs there)", async () => {
    await resetDb();
    for (const statement of MIGRATION.split("--> statement-breakpoint")) await sql.unsafe(statement);
    expect(await db.select().from(schema.content)).toHaveLength(0);
    await importAndMigrate();
  });
});

describe("Pridružite se (ZUP-23)", () => {
  beforeAll(importAndMigrate);

  it("is off for ŽPS, whose sessions stay under 'Seje', and on for every other group", async () => {
    const zps = await data.getGroup("zupnijski-pastoralni-svet");
    expect(zps).toMatchObject({ hideJoin: true, meetingsTitle: "Seje", meetingSchedule: "Prvi torek v mesecu ob 19.15", location: "Župnišče" });
    for (const slug of ["zupnijska-karitas", "molitvena-skupina", "odrasli-pevski-zbor", "ministranti"]) {
      expect((await data.getGroup(slug))?.hideJoin).toBe(false);
    }
  });

  it("is a switch in the editor", () => {
    expect(TYPES.parishGroup.fields.find((f) => f.name === "hideJoin")).toMatchObject({ kind: "boolean", label: "Skrij razdelek »Pridružite se«" });
  });
});

describe("prayer request (ZUP-25)", () => {
  const OK = { group: "molitvena-skupina", text: "Za zdravje moje mame.", consent: "on" };
  const send = (d: Record<string, unknown>, ip = "1.2.3.4") => submitPrayerRequest(d, { ip });

  beforeAll(importAndMigrate);
  beforeEach(async () => {
    await sql`truncate rate_limit_hits`;
    clearDevOutbox();
  });

  it("is on for the prayer group only, with the text 'vsebina' above it", async () => {
    expect(await data.getGroup("molitvena-skupina")).toMatchObject({ prayerRequests: true, prayerIntro: "vsebina" });
    expect((await data.getGroups()).length).toBe(16);
    expect((await data.getGroup("mladinska-skupina"))?.prayerRequests).toBe(false);
  });

  it("mails only the text and the date to the address set in the editor, and stores nothing", async () => {
    const before = await tableCounts();
    const r = await send(OK, "203.0.113.7");
    expect(r).toEqual({ ok: true, message: PRAYER_THANKS });
    expect(devOutbox()).toHaveLength(1);
    const [mail] = devOutbox();
    expect(mail.to).toBe("zupirnice@gmail.com");
    expect(mail.subject).toBe(PRAYER_SUBJECT);
    expect(mail.text).toBe(prayerMailText(OK.text, new Date(process.env.TEST_NOW!)));
    expect(mail.text).toBe("Oddano: 27. 10. 2026 ob 10.00\n\nZa zdravje moje mame.");
    expect(mail.text).not.toContain("203.0.113.7");
    expect(Object.keys(mail).sort()).toEqual(["at", "subject", "text", "to"]);
    expect(await tableCounts()).toEqual(before);
    // Only the rate limit's key, and no text, is left behind.
    const hits = await db.select().from(schema.rateLimitHits);
    expect(hits.map((h) => h.key)).toEqual(["molitev:203.0.113.7"]);
  });

  it("goes to another address when the editor sets one, and to the default when it is empty", async () => {
    await sql`update content set data = data || '{"prayerEmail": "zupnik@example.com"}' where slug = 'molitvena-skupina'`;
    await send(OK);
    expect(devOutbox()[0].to).toBe("zupnik@example.com");
    await sql`update content set data = data - 'prayerEmail' where slug = 'molitvena-skupina'`;
    clearDevOutbox();
    await send(OK, "5.6.7.8");
    expect(devOutbox()[0].to).toBe(PRAYER_EMAIL_DEFAULT);
    await sql`update content set data = data || '{"prayerEmail": "zupirnice@gmail.com"}' where slug = 'molitvena-skupina'`;
  });

  it("needs the text (at most 1000 characters) and the consent", async () => {
    const empty = await send({ ...OK, text: "  " });
    expect(empty).toMatchObject({ ok: false, message: CHECK_FIELDS, fieldErrors: { text: "Vpišite svojo prošnjo." } });
    const long = await send({ ...OK, text: "a".repeat(1001) });
    expect(long).toMatchObject({ ok: false, fieldErrors: { text: "Prošnja je lahko dolga največ 1000 znakov." } });
    expect((await send({ ...OK, text: "a".repeat(1000) })).ok).toBe(true);
    clearDevOutbox();
    const noConsent = await send({ group: OK.group, text: OK.text });
    expect(noConsent).toMatchObject({ ok: false, fieldErrors: { consent: "Za oddajo potrdite soglasje." } });
    expect(devOutbox()).toHaveLength(0);
  });

  it("is refused for a group without the form", async () => {
    const r = await send({ ...OK, group: "mladinska-skupina" });
    expect(r.ok).toBe(false);
    expect(devOutbox()).toHaveLength(0);
  });

  it("answers a filled honeypot with the thanks and sends nothing", async () => {
    expect(await send({ ...OK, website: "http://spam" })).toEqual({ ok: true, message: PRAYER_THANKS });
    expect(devOutbox()).toHaveLength(0);
  });

  it("refuses more than 5 requests in 10 minutes from one IP", async () => {
    for (let i = 0; i < 5; i++) expect((await send(OK, "9.9.9.9")).ok).toBe(true);
    expect(await send(OK, "9.9.9.9")).toMatchObject({ ok: false, message: TOO_MANY, status: 429 });
    expect(devOutbox()).toHaveLength(5);
    expect((await send(OK, "8.8.8.8")).ok).toBe(true);
  });
});
