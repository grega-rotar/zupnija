import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { db, schema } from "@/db";
import { defineAction, listActions } from "@/lib/admin/registry";
import { toResult } from "@/lib/admin/errors";
import type { Actor } from "@/lib/admin/sections";
import { AiBusyError, setRunClaude, type RunClaudeOptions } from "@/lib/ai/runClaude";
import { makeUser, resetDb } from "@/test/db";
import { askAssistant, BUSY_REPLY, UNCLEAR_REPLY } from "./ask";
import { buildContext } from "./context";
import { confirmProposal } from "./confirm";
import { greeting, pl, suggestions } from "./greeting";
import { buildPrompt } from "./prompt";

// Stand-ins only when the real feature actions are not registered yet.
if (!listActions().includes("mass.cancel"))
  defineAction({
    name: "mass.cancel",
    area: "mase",
    approvable: true,
    schema: z.object({ massId: z.number(), reason: z.string().optional(), intentionHandling: z.enum(["next", "keep"]).optional() }),
    label: () => "Odpoved maše",
    apply: (p, { track }) => track.update("masses", p.massId, { status: "cancelled", cancelReason: p.reason ?? null }),
    tags: ["masses"],
  });

const ask = [{ role: "user" as const, text: "Odpovej mašo v sredo" }];
let prompts: string[] = [];
const reply = (...texts: string[]) => {
  prompts = [];
  let i = 0;
  setRunClaude(async (o: RunClaudeOptions) => {
    prompts.push(o.prompt);
    expect(o.allowedTools).toEqual([]);
    return { text: texts[Math.min(i++, texts.length - 1)], durationMs: 1 };
  });
};

let blaz: Actor, ana: Actor, wedMass: number, sunMass: number, groupId: number;

describe("assistant", () => {
  beforeEach(async () => {
    await resetDb();
    blaz = await makeUser("blaz", { name: "msgr. dr. Blaž Jezeršek", isOwner: true });
    ana = await makeUser("ana", { name: "Ana Rozman", sections: ["verouk"] });
    const [ch] = await db.insert(schema.churches).values({ slug: "marija", name: "Marijina cerkev", shortName: "Marijina cerkev" }).returning();
    const ms = await db
      .insert(schema.masses)
      .values([
        { date: "2026-10-28", time: "18:30", churchId: ch.id },
        { date: "2026-11-01", time: "08:00", churchId: ch.id, type: "sunday" },
        { date: "2026-11-01", time: "10:00", churchId: ch.id, type: "sunday" },
      ])
      .returning();
    [wedMass, sunMass] = [ms[0].id, ms[1].id];
    await db.insert(schema.intentions).values({ massId: ms[2].id, text: "Ana Kos" });
    const [g] = await db.insert(schema.catechesisGroups).values({ name: "4.–6. razred", weekday: 3, time: "16:30", place: "Učilnica" }).returning();
    groupId = g.id;
  });
  afterEach(() => setRunClaude(null));

  it("gives Ana only Verouk data and cancel_lesson", async () => {
    const ctx = await buildContext(ana);
    expect(ctx.masses).toBeUndefined();
    expect(ctx.allowed).toEqual(["cancel_lesson"]);
    expect(ctx.lessons?.find((l) => l.date === "2026-10-28")).toMatchObject({ groupId, time: "16:30", cancelled: false });
    const p = buildPrompt(ana, ctx, ask);
    expect(p).toContain("cancel_lesson");
    for (const s of ["massId", "masses", "cancel_mass", "add_intention", "open_upload", '"type": "event"', "odpoved maše", "Marijina cerkev"])
      expect(p).not.toContain(s);
  });

  it("gives Blaž masses and every proposal type", async () => {
    const ctx = await buildContext(blaz);
    expect(ctx.masses?.map((m) => m.massId)).toEqual([wedMass, sunMass, sunMass + 1]);
    expect(ctx.masses?.[0]).toMatchObject({ weekday: "sreda", time: "18:30", church: "Marijina cerkev", status: "scheduled" });
    const p = buildPrompt(blaz, ctx, ask);
    for (const t of ["add_intention", "cancel_mass", "event", "open_upload", "cancel_lesson"]) expect(p).toContain(`"type": "${t}"`);
    expect(p).toContain(`"massId":${wedMass}`);
    expect(p).toContain("Odpovej mašo v sredo");
  });

  it("only proposes: masses unchanged, one cancel_mass with the mass id", async () => {
    reply(JSON.stringify({ reply: "Tole bi spremenil. Preverite in potrdite.", proposals: [{ type: "cancel_mass", massId: wedMass }] }));
    const before = await db.select().from(schema.masses);
    const r = await askAssistant(blaz, ask);
    expect(r.reply).toBe("Tole bi spremenil. Preverite in potrdite.");
    expect(r.proposals).toEqual([{ type: "cancel_mass", massId: wedMass }]);
    expect(await db.select().from(schema.masses)).toEqual(before);
  });

  it("drops unknown ids and types the actor may not use", async () => {
    reply("```json\n" + JSON.stringify({
      reply: "x",
      proposals: [
        { type: "cancel_mass", massId: 99999 },
        { type: "cancel_lesson", groupId, date: "2026-10-29" },
        { type: "cancel_lesson", groupId, date: "2026-10-28", message: "Počitnice" },
        { type: "nonsense" },
      ],
    }) + "\n```");
    expect((await askAssistant(blaz, ask)).proposals).toEqual([{ type: "cancel_lesson", groupId, date: "2026-10-28", message: "Počitnice" }]);
    reply(JSON.stringify({ reply: "x", proposals: [{ type: "cancel_mass", massId: wedMass }, { type: "cancel_lesson", groupId, date: "2026-10-28" }] }));
    expect((await askAssistant(ana, ask)).proposals).toEqual([{ type: "cancel_lesson", groupId, date: "2026-10-28" }]);
  });

  it("passes kindIsGuess through", async () => {
    reply(JSON.stringify({ reply: "Tole bi dodal.", proposals: [{ type: "add_intention", massId: sunMass, text: "Jože Novak", kind: "deceased", kindIsGuess: true }] }));
    const r = await askAssistant(blaz, [{ role: "user", text: "Dodaj namen za Jožeta Novaka v nedeljo ob 8h" }]);
    expect(r.proposals).toEqual([{ type: "add_intention", massId: sunMass, text: "Jože Novak", kind: "deceased", kindIsGuess: true }]);
  });

  it("maps a busy pool to the busy reply", async () => {
    setRunClaude(async () => {
      throw new AiBusyError();
    });
    expect(await askAssistant(blaz, ask)).toEqual({ busy: true, reply: BUSY_REPLY, proposals: [] });
  });

  it("retries once on invalid JSON, then gives up politely", async () => {
    reply("ne vem", JSON.stringify({ reply: "Drugič.", proposals: [] }));
    expect(await askAssistant(blaz, ask)).toEqual({ reply: "Drugič.", proposals: [] });
    expect(prompts).toHaveLength(2);
    reply("ne vem", "{ še vedno ne");
    const r = await askAssistant(blaz, ask);
    expect(r.reply).toBe(UNCLEAR_REPLY);
    expect(r.proposals).toEqual([]);
    expect(prompts).toHaveLength(2);
  });

  it("confirming runs the engine action with its permission check", async () => {
    const forged = await toResult(() => confirmProposal(ana, { type: "cancel_mass", massId: wedMass }, { reason: "x" }));
    expect(forged).toMatchObject({ ok: false, forbidden: true });
    expect((await db.select().from(schema.masses).where(eq(schema.masses.id, wedMass)))[0].status).toBe("scheduled");

    const ok = await confirmProposal(blaz, { type: "cancel_mass", massId: wedMass }, { reason: "Župnik je odsoten." });
    expect(ok.status).toBe("applied");
    const [m] = await db.select().from(schema.masses).where(eq(schema.masses.id, wedMass));
    expect(m).toMatchObject({ status: "cancelled", cancelReason: "Župnik je odsoten." });
    await expect(confirmProposal(blaz, { type: "open_upload" })).rejects.toThrow("na zaslonu");
  });

  it("greets with Slovenian number forms", async () => {
    expect(pl(1, ["maša", "maši", "maše", "maš"])).toBe("1 maša");
    expect(pl(2, ["maša", "maši", "maše", "maš"])).toBe("2 maši");
    expect(pl(4, ["maša", "maši", "maše", "maš"])).toBe("4 maše");
    expect(pl(8, ["maša", "maši", "maše", "maš"])).toBe("8 maš");
    // This week is Sunday 25 – Saturday 31 October: only Wednesday's Mass; Sunday 1 November is next week.
    expect(await greeting(blaz)).toBe("Dober dan. Ta teden je 1 maša, brez namena je še ena.");
    await db.insert(schema.changeRequests).values([1, 2].map(() => ({ section: "mase" as const, action: "intention.add", payload: {}, label: "x", createdBy: ana.id })));
    expect(await greeting(blaz)).toContain("2 spremembi čakata vašo potrditev.");
    expect(await greeting(ana)).toBe("Pozdravljeni, Ana. Pri verouku vam lahko odpovem uro ali pripravim sporočilo staršem.");
    expect(await suggestions(ana)).toEqual(["Odpovej verouk za 4.–6. razred v sredo", "Kaj je ta teden?"]);
    expect(await suggestions(blaz)).toContain("Naloži oznanila");
  });
});
