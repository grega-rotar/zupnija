import { beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { db, schema } from "@/db";
import { resetDb } from "@/test/db";
import { CHECK_FIELDS, clientIp, fields, formValues, submitPublicForm, TOO_MANY } from "./public";

const form = z.object({ name: fields.text("Vpišite ime."), email: fields.email() });
const send = (data: Record<string, unknown>, ip = "1.2.3.4") =>
  submitPublicForm({
    form: "test",
    schema: form,
    data,
    ip,
    thanks: "Hvala.",
    handle: async (p) => {
      await db.insert(schema.rateLimitHits).values({ key: `stored:${p.email}` });
      return { ok: true, message: "Shranjeno." };
    },
  });
const stored = async () => (await db.select().from(schema.rateLimitHits)).filter((r) => r.key.startsWith("stored:")).length;

describe("submitPublicForm", () => {
  beforeEach(resetDb);

  it("validates with Slovenian messages per field and echoes the values", async () => {
    const r = await send({ name: "", email: "abc" });
    expect(r).toMatchObject({ ok: false, message: CHECK_FIELDS, fieldErrors: { name: "Vpišite ime.", email: "Vpišite veljaven e-poštni naslov." } });
    expect(!r.ok && r.values).toMatchObject({ name: "", email: "abc" });
    expect(await stored()).toBe(0);
  });

  it("answers a filled honeypot with the thank-you text and stores nothing", async () => {
    const r = await send({ name: "Bot", email: "bot@example.com", website: "http://spam" });
    expect(r).toEqual({ ok: true, message: "Hvala." });
    expect(await db.select().from(schema.rateLimitHits)).toHaveLength(0);
  });

  it("allows 5 per 10 minutes per form and IP, then 429", async () => {
    for (let i = 0; i < 5; i++) expect((await send({ name: "Ana", email: `a${i}@example.com` })).ok).toBe(true);
    const sixth = await send({ name: "Ana", email: "a6@example.com" });
    expect(sixth).toMatchObject({ ok: false, message: TOO_MANY, status: 429 });
    expect(await stored()).toBe(5);
    // Another IP is not affected.
    expect((await send({ name: "Ana", email: "b@example.com" }, "5.6.7.8")).ok).toBe(true);
  });

  it("reads the IP from CF-Connecting-IP, then X-Forwarded-For", () => {
    expect(clientIp(new Headers({ "cf-connecting-ip": "9.9.9.9", "x-forwarded-for": "1.1.1.1" }))).toBe("9.9.9.9");
    expect(clientIp(new Headers({ "x-forwarded-for": "1.1.1.1, 10.0.0.1" }))).toBe("1.1.1.1");
    expect(clientIp(new Headers())).toBe("unknown");
  });

  it("turns repeated FormData keys into arrays and drops $ACTION keys", () => {
    const fd = new FormData();
    fd.append("a", "1");
    fd.append("b", "x");
    fd.append("b", "y");
    fd.append("$ACTION_ID_1", "");
    expect(formValues(fd)).toEqual({ a: "1", b: ["x", "y"] });
  });
});
