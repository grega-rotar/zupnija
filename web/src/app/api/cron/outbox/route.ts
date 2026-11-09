/**
 * The outbox sender, called every 5 minutes by a cron on the host
 * (docs/TECHNICAL.md, "Newsletter"): `Authorization: Bearer $CRON_SECRET`
 * or `X-Cron-Secret: $CRON_SECRET`. Without CRON_SECRET set it refuses.
 * Each run also deletes newsletter addresses left unconfirmed for 48 hours.
 */
import { timingSafeEqual } from "node:crypto";
import { sendDue } from "@/lib/mail/outbox";
import { deleteUnconfirmed } from "@/lib/newsletter/service";

function authorised(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const given = req.headers.get("x-cron-secret") ?? req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const a = Buffer.from(given), b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function run(req: Request): Promise<Response> {
  if (!process.env.CRON_SECRET) return Response.json({ error: "CRON_SECRET ni nastavljen." }, { status: 503 });
  if (!authorised(req)) return Response.json({ error: "Ni dovoljeno." }, { status: 401 });
  const result = await sendDue();
  // Addresses not confirmed within 48 hours are deleted (ZUP-19).
  const deleted = await deleteUnconfirmed();
  return Response.json({ ...result, deleted }, { headers: { "Cache-Control": "no-store" } });
}

export const GET = run;
export const POST = run;
