/**
 * The public PDF route GET /oznanila/<period_start>/oznanila.pdf: only a
 * published bulletin's original PDF, with caching headers. Clock: 2026-10-27.
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { db, schema } from "@/db";
import { resetDb } from "@/test/db";
import { seedParish } from "@/test/seed";
import { GET } from "@/app/(site)/oznanila/[slug]/oznanila.pdf/route";

const BYTES = Buffer.from("%PDF-1.4\n% oznanila\n%%EOF\n");
let dir = "";

beforeAll(() => {
  dir = mkdtempSync(path.join(os.tmpdir(), "zupnija-pdf-"));
  process.env.UPLOAD_DIR = dir;
  mkdirSync(path.join(dir, "ab"), { recursive: true });
  writeFileSync(path.join(dir, "ab", "abc.pdf"), BYTES);
  writeFileSync(path.join(dir, "ab", "abc.jpg"), Buffer.from([0xff, 0xd8, 0xff]));
});
afterAll(() => rmSync(dir, { recursive: true, force: true }));

beforeEach(async () => {
  await resetDb();
  await seedParish(db);
});

const get = (start: string, headers: Record<string, string> = {}) =>
  GET(new Request(`http://localhost/oznanila/${start}/oznanila.pdf`, { headers }), { params: Promise.resolve({ slug: start }) });

async function bulletin(start: string, status: "published" | "draft" | "pending", mime = "application/pdf") {
  const ext = mime === "application/pdf" ? "pdf" : "jpg";
  const [u] = await db.insert(schema.uploads).values({ filename: `o.${ext}`, mime, size: 3, path: `ab/abc.${ext}`, sha256: `sha-${start}` }).returning();
  await db.insert(schema.bulletins).values({ periodStart: start, periodEnd: start.replace(/-01$/, "-30"), title: "Oktober 2026", status, uploadId: u.id });
}

describe("PDF route [integration]", () => {
  it("serves a published bulletin's PDF with type, filename, cache headers and ETag", async () => {
    await bulletin("2026-09-01", "published");
    const res = await get("2026-09-01");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/pdf");
    expect(res.headers.get("content-disposition")).toBe('inline; filename="oznanila-oktober-2026.pdf"');
    expect(res.headers.get("cache-control")).toBe("public, max-age=3600, must-revalidate");
    expect(res.headers.get("etag")).toBe('"sha-2026-09-01"');
    expect(Buffer.from(await res.arrayBuffer())).toEqual(BYTES);
    const again = await get("2026-09-01", { "if-none-match": '"sha-2026-09-01"' });
    expect(again.status).toBe(304);
  });

  it("is 404 for drafts, pending bulletins, images, unknown periods and bad paths", async () => {
    await bulletin("2026-09-01", "draft");
    await bulletin("2026-08-01", "pending");
    await bulletin("2026-07-01", "published", "image/jpeg");
    for (const start of ["2026-09-01", "2026-08-01", "2026-07-01", "2026-12-01", "../../etc"]) {
      const res = await get(start);
      expect(res.status, start).toBe(404);
      expect(res.headers.get("cache-control")).toBe("no-store");
    }
  });
});
