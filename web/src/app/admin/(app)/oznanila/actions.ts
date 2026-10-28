"use server";
/**
 * Server actions of the oznanila screens (list and upload flow). Each one
 * requires the oznanila section; the bulletin service does the work.
 */
import { readFile } from "node:fs/promises";
import "@/lib/admin/next";
import "@/lib/admin/registry";
import { toResult, UserError, type ActionResult } from "@/lib/admin/errors";
import { requireArea } from "@/lib/admin/session";
import { discardDraft, getBulletin, publishBulletin, saveDraftForLater, startBulletin, startManualBulletin } from "@/lib/bulletin/service";
import { setReadingHints } from "@/lib/bulletin/hints";
import { uploadPath } from "@/lib/bulletin/storage";
import { allIntentions, readableDraftSchema, type ReadableDraft } from "@/lib/bulletin/types";
import { db, schema } from "@/db";
import { eq } from "drizzle-orm";
import { armDevFixture } from "./dev-fixture";
import { toFlow, type FlowBulletin } from "./flow";

async function load(id: unknown): Promise<FlowBulletin> {
  if (typeof id !== "number" || !Number.isInteger(id)) throw new UserError("Teh oznanil ni več.");
  const b = await getBulletin(id);
  if (!b) throw new UserError("Teh oznanil ni več.");
  return toFlow(b);
}

/** The month the upload is meant for ("YYYY-MM-01"); the document's own period wins later. */
const periodStartOf = (v: unknown) => {
  const s = typeof v === "string" ? v : "";
  return /^\d{4}-\d{2}-01$/.test(s) ? s : undefined;
};

/** The picked file → stored upload, bulletin "reading", Claude reads it after the response. */
export async function uploadBulletinAction(fd: FormData): Promise<ActionResult<FlowBulletin>> {
  const actor = await requireArea("oznanila");
  return toResult(async () => {
    const file = fd.get("file");
    if (!(file instanceof File) || file.size === 0) throw new UserError("Izberite datoteko.");
    armDevFixture(file.name);
    const { bulletinId } = await startBulletin({ periodStart: periodStartOf(fd.get("periodStart")), file }, actor);
    return load(bulletinId);
  });
}

/**
 * "Poskusi znova" after claude-pool was busy or reading failed: read the
 * same stored file again (startBulletin with its bytes; nothing to re-pick).
 */
export async function retryBulletinAction(id: number): Promise<ActionResult<FlowBulletin>> {
  const actor = await requireArea("oznanila");
  return toResult(async () => {
    const b = await getBulletin(id);
    if (!b) throw new UserError("Teh oznanil ni več.");
    if (!b.upload) throw new UserError("Datoteke ni več. Naložite jo znova.");
    const [u] = await db.select().from(schema.uploads).where(eq(schema.uploads.id, b.upload.id));
    const bytes = u ? await readFile(uploadPath(u)).catch(() => null) : null;
    if (!u || !bytes) throw new UserError("Datoteke ni več. Naložite jo znova.");
    armDevFixture(u.filename);
    const { bulletinId } = await startBulletin({ periodStart: b.periodStart.endsWith("-01") ? b.periodStart : undefined, file: { name: u.filename, type: u.mime, bytes: new Uint8Array(bytes) } }, actor);
    return load(bulletinId);
  });
}

/** "Vpiši ročno": an empty draft for the month. */
export async function manualBulletinAction(periodStart: string): Promise<ActionResult<FlowBulletin>> {
  const actor = await requireArea("oznanila");
  return toResult(async () => {
    const { bulletinId } = await startManualBulletin({ periodStart: periodStartOf(periodStart) }, actor);
    return load(bulletinId);
  });
}

/** Polled every 2 s while Claude reads. */
export async function bulletinStateAction(id: number): Promise<ActionResult<FlowBulletin>> {
  await requireArea("oznanila");
  return toResult(() => load(id));
}

function parseDraft(draft: unknown): ReadableDraft {
  const r = readableDraftSchema.safeParse(draft);
  if (!r.success) {
    const where = r.error.issues[0]?.path.join(".") ?? "";
    if (/intentions/.test(where)) throw new UserError("Preverite vpisane namene: vsak potrebuje besedilo (največ 200 znakov).");
    if (/events/.test(where)) throw new UserError("Preverite srečanja: vsako potrebuje naslov in datum.");
    throw new UserError("Osnutek ni veljaven. Preverite vpisano.");
  }
  return r.data;
}

/** "Shrani za pozneje": keeps every edit (intentions, notices, events, texts). */
export async function saveBulletinDraftAction(id: number, draft: unknown): Promise<ActionResult<null>> {
  await requireArea("oznanila");
  return toResult(async () => {
    await load(id);
    await saveDraftForLater(id, parseDraft(draft));
    return null;
  });
}

/** "Zavrzi": the period shows as missing again. */
export async function discardBulletinAction(id: number): Promise<ActionResult<null>> {
  await requireArea("oznanila");
  return toResult(async () => {
    await discardDraft(id);
    return null;
  });
}

/** "Navodila za branje oznanil" (owner only): returns the history id for "Razveljavi". */
export async function saveReadingHintsAction(text: string): Promise<ActionResult<{ historyId: number | null }>> {
  const actor = await requireArea("oznanila");
  return toResult(async () => {
    if (!actor.isOwner) throw new UserError("Navodila za branje ureja župnik.");
    const r = await setReadingHints(actor, String(text ?? ""));
    return { historyId: r.status === "applied" ? r.historyId : null };
  });
}

export type PublishOutcome = { intentions: number; notices: number; events: number; skipped: number } & (
  | { status: "applied"; historyId: number }
  | { status: "pending" }
);

/**
 * "Objavi oznanila" / "Pošlji župniku": saves the edited draft, then
 * publishes with the chosen flag resolutions (contract: saveDraftForLater,
 * then { bulletinId, resolutions }).
 */
export async function publishBulletinAction(id: number, draft: unknown, resolutions: Record<string, string>): Promise<ActionResult<PublishOutcome>> {
  const actor = await requireArea("oznanila");
  return toResult(async () => {
    await load(id);
    const d = parseDraft(draft);
    const intentions = allIntentions(d).length;
    const events = d.events.filter((e) => e.include).length;
    if (!intentions && !d.notices.length && !events) throw new UserError("Dodajte vsaj en namen ali obvestilo.");
    await saveDraftForLater(id, d);
    const r = await publishBulletin(actor, { bulletinId: id, resolutions: resolutions ?? {} });
    if (r.status === "pending") return { status: "pending", intentions, notices: d.notices.length, events, skipped: 0 };
    const res = (r.result ?? {}) as { intentions?: number; notices?: number; events?: number; skipped?: number };
    return {
      status: "applied",
      historyId: r.historyId,
      intentions: res.intentions ?? intentions,
      notices: res.notices ?? d.notices.length,
      events: res.events ?? events,
      skipped: res.skipped ?? 0,
    };
  });
}
