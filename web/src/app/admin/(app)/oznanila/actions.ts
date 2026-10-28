"use server";
/**
 * Server actions of the oznanila screens (list and upload flow). Each one
 * requires the oznanila section; the bulletin service does the work.
 */
import "@/lib/admin/next";
import "@/lib/admin/registry";
import { toResult, UserError, type ActionResult } from "@/lib/admin/errors";
import { requireArea } from "@/lib/admin/session";
import {
  discardDraft,
  getBulletin,
  nextWeekStart,
  publishBulletin,
  saveDraftForLater,
  startBulletin,
  startManualBulletin,
} from "@/lib/bulletin/service";
import { readableDraftSchema, type ReadableDraft } from "@/lib/bulletin/types";
import { armDevFixture } from "./dev-fixture";
import { toFlow, type FlowBulletin } from "./flow";

async function load(id: unknown): Promise<FlowBulletin> {
  if (typeof id !== "number" || !Number.isInteger(id)) throw new UserError("Teh oznanil ni več.");
  const b = await getBulletin(id);
  if (!b) throw new UserError("Teh oznanil ni več.");
  return toFlow(b);
}

/** The picked file → stored upload, bulletin "reading", Claude reads it after the response. */
export async function uploadBulletinAction(fd: FormData): Promise<ActionResult<FlowBulletin>> {
  const actor = await requireArea("oznanila");
  return toResult(async () => {
    const file = fd.get("file");
    if (!(file instanceof File) || file.size === 0) throw new UserError("Izberite datoteko.");
    const week = String(fd.get("weekStart") || nextWeekStart());
    armDevFixture(file.name, week);
    const { bulletinId } = await startBulletin({ weekStart: week, file }, actor);
    return load(bulletinId);
  });
}

/** "Vpiši ročno": an empty draft for the week. */
export async function manualBulletinAction(weekStart: string): Promise<ActionResult<FlowBulletin>> {
  const actor = await requireArea("oznanila");
  return toResult(async () => {
    const { bulletinId } = await startManualBulletin({ weekStart: String(weekStart || nextWeekStart()) }, actor);
    return load(bulletinId);
  });
}

/** Polled every 2 s while Claude reads. */
export async function bulletinStateAction(id: number): Promise<ActionResult<FlowBulletin>> {
  await requireArea("oznanila");
  return toResult(() => load(id));
}

function parseDraft(draft: unknown, weekStart: string): ReadableDraft {
  const d = (draft ?? {}) as { notices?: unknown };
  const notices = Array.isArray(d.notices) ? d.notices.filter((n) => typeof n === "string" && n.trim()) : d.notices;
  const r = readableDraftSchema.safeParse({ ...(draft as object), notices, weekStart });
  if (!r.success) throw new UserError("Preverite vpisane namene: vsak potrebuje datum, uro, cerkev in besedilo.");
  return r.data;
}

/** "Shrani za pozneje": keeps the edited notices and hand-added rows. */
export async function saveBulletinDraftAction(id: number, draft: unknown): Promise<ActionResult<null>> {
  await requireArea("oznanila");
  return toResult(async () => {
    const b = await load(id);
    await saveDraftForLater(id, parseDraft(draft, b.weekStart));
    return null;
  });
}

/** "Zavrzi": the week shows as missing again. */
export async function discardBulletinAction(id: number): Promise<ActionResult<null>> {
  await requireArea("oznanila");
  return toResult(async () => {
    await discardDraft(id);
    return null;
  });
}

export type PublishOutcome = { status: "applied"; historyId: number; intentions: number; notices: number } | { status: "pending"; intentions: number; notices: number };

/**
 * "Objavi oznanila" / "Pošlji župniku": saves the edited draft (notices,
 * hand-added rows), then publishes with the chosen flag resolutions.
 */
export async function publishBulletinAction(id: number, draft: unknown, resolutions: Record<string, string>): Promise<ActionResult<PublishOutcome>> {
  const actor = await requireArea("oznanila");
  return toResult(async () => {
    const b = await load(id);
    const d = parseDraft(draft, b.weekStart);
    if (!d.items.length && !d.notices.length) throw new UserError("Dodajte vsaj en namen ali obvestilo.");
    await saveDraftForLater(id, d);
    const r = await publishBulletin(actor, { bulletinId: id, resolutions: resolutions ?? {}, notices: d.notices });
    const counts = { intentions: d.items.length, notices: d.notices.length };
    return r.status === "applied" ? { status: "applied", historyId: r.historyId, ...counts } : { status: "pending", ...counts };
  });
}
