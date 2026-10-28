/**
 * US-010: .ics per event, the /koledar.ics feed and the Google link.
 * Clock: 2026-10-27 10:00 (vitest.config.ts); seed: src/test/seed.ts.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { resetDb } from "@/test/db";
import { seedParish, type SeededParish } from "@/test/seed";
import { getEvent } from "@/lib/data/events";
import { GET as eventRoute } from "@/app/(site)/dogodki/[slug]/dogodek.ics/route";
import { GET as feedRoute } from "@/app/(site)/koledar.ics/route";
import { calendarIcs, eventIcs, fold, googleCalendarUrl, localStamp, type CalEvent } from "./ics";
import { eventToCal } from "./feed";

// ───────────── A small RFC 5545 reader: unfold, split components, parse properties ─────────────

type Prop = { name: string; params: Record<string, string>; value: string };
type Component = { type: string; props: Prop[]; children: Component[] };

const unescape = (v: string) => v.replace(/\\n/gi, "\n").replace(/\\([\\;,])/g, "$1");

function parseIcs(text: string): Component {
  expect(text).toMatch(/\r\n$/);
  for (const line of text.split("\r\n")) expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
  const lines = text.replace(/\r\n[ \t]/g, "").split("\r\n").filter(Boolean);
  const stack: Component[] = [{ type: "ROOT", props: [], children: [] }];
  for (const line of lines) {
    const colon = line.indexOf(":");
    const [name, ...params] = line.slice(0, colon).split(";");
    const value = line.slice(colon + 1);
    if (name === "BEGIN") {
      const c = { type: value, props: [], children: [] };
      stack.at(-1)!.children.push(c);
      stack.push(c);
    } else if (name === "END") {
      expect(stack.pop()!.type).toBe(value);
    } else {
      stack.at(-1)!.props.push({ name, params: Object.fromEntries(params.map((p) => p.split("="))), value });
    }
  }
  expect(stack).toHaveLength(1);
  return stack[0].children[0];
}
const prop = (c: Component, name: string) => c.props.find((p) => p.name === name);
const text = (c: Component, name: string) => unescape(prop(c, name)?.value ?? "");
const events = (cal: Component) => cal.children.filter((c) => c.type === "VEVENT");

const SAMPLE: CalEvent = {
  uid: "event-1",
  title: "Molitev za rajne na pokopališču",
  date: "2026-11-01",
  time: "14:00",
  location: "Pokopališče Pirniče",
  description: "Po molitvi blagoslov grobov; prinesite sveče, lučke.\nVsi vabljeni.",
  url: "https://zupnija-pirnice.si/dogodki/molitev-za-rajne-na-pokopaliscu-1",
};

describe("eventIcs", () => {
  it("is valid iCalendar with a VTIMEZONE, the Ljubljana start and a stable UID", () => {
    const ics = eventIcs(SAMPLE, new Date("2026-10-27T09:00:00Z"));
    expect(ics).toContain("DTSTART;TZID=Europe/Ljubljana:20261101T140000");
    const cal = parseIcs(ics);
    expect(cal.type).toBe("VCALENDAR");
    expect(text(cal, "VERSION")).toBe("2.0");
    const tz = cal.children.find((c) => c.type === "VTIMEZONE")!;
    expect(text(tz, "TZID")).toBe("Europe/Ljubljana");
    expect(tz.children.map((c) => c.type)).toEqual(["DAYLIGHT", "STANDARD"]);
    const [ev] = events(cal);
    expect(prop(ev, "DTSTART")).toEqual({ name: "DTSTART", params: { TZID: "Europe/Ljubljana" }, value: "20261101T140000" });
    expect(prop(ev, "DTEND")!.value).toBe("20261101T150000");
    expect(text(ev, "UID")).toBe("event-1@zupnija-pirnice.si");
    expect(text(ev, "SUMMARY")).toBe(SAMPLE.title);
    expect(text(ev, "LOCATION")).toBe("Pokopališče Pirniče");
    expect(text(ev, "DESCRIPTION")).toBe(SAMPLE.description);
    expect(text(ev, "URL")).toBe(SAMPLE.url);
    expect(text(ev, "DTSTAMP")).toBe("20261027T090000Z");
  });

  it("keeps the wall clock across the DST switch (25 October 2026) and never writes UTC times", () => {
    const before = eventIcs({ ...SAMPLE, date: "2026-10-24", time: "18:30" });
    const after = eventIcs({ ...SAMPLE, date: "2026-10-25", time: "18:30" });
    expect(before).toContain("DTSTART;TZID=Europe/Ljubljana:20261024T183000");
    expect(after).toContain("DTSTART;TZID=Europe/Ljubljana:20261025T183000");
    expect(after).not.toMatch(/DTSTART[^\r]*Z\r/);
  });

  it("ends past midnight on the next day", () => {
    expect(localStamp("2026-12-24", "23:30", 90)).toBe("20261225T010000");
  });

  it("folds long lines at 75 octets without splitting a character", () => {
    const line = `DESCRIPTION:${"Žž".repeat(60)}`;
    const folded = fold(line);
    expect(folded.replace(/\r\n /g, "")).toBe(line);
    for (const l of folded.split("\r\n")) expect(new TextEncoder().encode(l).length).toBeLessThanOrEqual(75);
  });
});

describe("googleCalendarUrl", () => {
  it("passes the Ljubljana wall clock with ctz, not UTC", () => {
    const url = new URL(googleCalendarUrl(SAMPLE));
    expect(url.origin + url.pathname).toBe("https://calendar.google.com/calendar/render");
    expect(url.searchParams.get("action")).toBe("TEMPLATE");
    expect(url.searchParams.get("dates")).toBe("20261101T140000/20261101T150000");
    expect(url.searchParams.get("ctz")).toBe("Europe/Ljubljana");
    expect(url.search).toContain("ctz=Europe%2FLjubljana");
    expect(url.searchParams.get("dates")).not.toContain("Z");
    expect(url.searchParams.get("text")).toBe(SAMPLE.title);
    expect(url.searchParams.get("location")).toBe("Pokopališče Pirniče");
  });
});

describe("calendar routes", () => {
  let s: SeededParish;
  beforeEach(async () => {
    await resetDb();
    s = await seedParish(db);
  });

  it("GET /dogodki/<slug>/dogodek.ics returns the event", async () => {
    const [row] = await db.select().from(schema.events).where(eq(schema.events.title, "Molitev za rajne na pokopališču"));
    const slug = `molitev-za-rajne-na-pokopaliscu-${row.id}`;
    const res = await eventRoute(new Request(`http://localhost/dogodki/${slug}/dogodek.ics`), { params: Promise.resolve({ slug }) });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("text/calendar; charset=utf-8");
    const [ev] = events(parseIcs(await res.text()));
    expect(text(ev, "UID")).toBe(`event-${row.id}@zupnija-pirnice.si`);
    expect(prop(ev, "DTSTART")!.value).toBe("20261101T140000");
    expect(text(ev, "SUMMARY")).toBe("Molitev za rajne na pokopališču");
    expect(text(ev, "LOCATION")).toBe("Pokopališče Pirniče");
    expect(text(ev, "DESCRIPTION")).toBe("Po molitvi blagoslov grobov.");
    expect(text(ev, "URL")).toMatch(new RegExp(`/dogodki/${slug}$`));
  });

  it("a legacy slug resolves, an unknown event is 404", async () => {
    const [row] = await db.select().from(schema.events).limit(1);
    await db.update(schema.events).set({ legacySlug: "seja-zps-2026-11" }).where(eq(schema.events.id, row.id));
    const ok = await eventRoute(new Request("http://localhost/x"), { params: Promise.resolve({ slug: "seja-zps-2026-11" }) });
    expect(ok.status).toBe(200);
    expect(await ok.text()).toContain(`UID:event-${row.id}@`);
    const missing = await eventRoute(new Request("http://localhost/x"), { params: Promise.resolve({ slug: "ni-ga-999999" }) });
    expect(missing.status).toBe(404);
  });

  it("GET /koledar.ics: events from 30 days back to 180 ahead, the next 60 days of Masses, cancelled ones left out", async () => {
    const before = await db.insert(schema.events).values({ title: "Pred okvirjem", date: "2026-09-26", time: "10:00", place: "" }).returning();
    const early = await db.insert(schema.events).values({ title: "Romanje", date: "2026-09-28", time: "07:00", place: "Brezje" }).returning();
    const late = await db.insert(schema.events).values({ title: "Birma", date: "2027-04-25", time: "10:00", place: "Marijina cerkev" }).returning();
    const after = await db.insert(schema.events).values({ title: "Za okvirjem", date: "2027-04-26", time: "10:00", place: "" }).returning();
    // Cancel Wednesday's Mass (28 October, 18.30).
    await db.update(schema.masses).set({ status: "cancelled", cancelReason: "Duhovnik odsoten" }).where(eq(schema.masses.id, s.masses["2026-10-28 18:30"]));

    const res = await feedRoute();
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("text/calendar; charset=utf-8");
    const cal = parseIcs(await res.text());
    expect(text(cal, "X-WR-CALNAME")).toBeTruthy();
    const list = events(cal);
    const uids = list.map((e) => text(e, "UID"));

    expect(uids).toContain(`event-${early[0].id}@zupnija-pirnice.si`);
    expect(uids).toContain(`event-${late[0].id}@zupnija-pirnice.si`);
    expect(uids).not.toContain(`event-${before[0].id}@zupnija-pirnice.si`);
    expect(uids).not.toContain(`event-${after[0].id}@zupnija-pirnice.si`);
    expect(uids.filter((u) => u.startsWith("event-"))).toHaveLength(5);

    const masses = list.filter((e) => text(e, "UID").startsWith("mass-"));
    const starts = masses.map((e) => prop(e, "DTSTART")!.value);
    expect(starts[0]).toBe("20261027T183000"); // today, 18.30
    expect(starts.at(-1)! <= "20261226T235900").toBe(true); // through 26 December (today + 60)
    expect(starts.some((x) => x.startsWith("20261226"))).toBe(true); // a Saturday evening Mass on the last day
    expect(uids).not.toContain(`mass-${s.masses["2026-10-28 18:30"]}@zupnija-pirnice.si`);

    const tuesday = masses.find((e) => prop(e, "DTSTART")!.value === "20261027T183000")!;
    expect(text(tuesday, "SUMMARY")).toBe("Sveta maša · Marijina cerkev");
    expect(text(tuesday, "DESCRIPTION")).toBe("† Štefan Hrovat");
    // After the DST switch the Sunday Masses keep their wall-clock times.
    expect(masses.some((e) => prop(e, "DTSTART")!.value === "20261101T080000" && text(e, "SUMMARY") === "Sveta maša · Sv. Križ")).toBe(true);
  });

  it("eventToCal takes the full description of an event page", async () => {
    const [row] = await db.select().from(schema.events).where(eq(schema.events.title, "Uradne ure Karitas"));
    const event = (await getEvent(`uradne-ure-karitas-${row.id}`))!;
    const cal = eventToCal(event, null);
    expect(cal).toMatchObject({ uid: `event-${row.id}`, date: "2026-11-02", time: "17:00", description: "Vsak prvi ponedeljek v mesecu od 17. do 18. ure." });
    expect(calendarIcs([cal])).toContain("DTSTART;TZID=Europe/Ljubljana:20261102T170000");
  });
});
