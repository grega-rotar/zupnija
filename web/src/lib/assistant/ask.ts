/**
 * One assistant turn (US-013, FR-12): build the context and prompt, run
 * claude-pool with no tools, validate the reply, and keep only proposals this
 * person may make about items the prompt actually contained. Nothing is
 * written here; confirm.ts does that through the engine.
 */
import "server-only";
import { db as defaultDb, type Db } from "@/db";
import type { Actor } from "@/lib/admin/sections";
import { AiBusyError, extractJson, runClaude } from "@/lib/ai/runClaude";
import { buildContext, type AssistantContext } from "./context";
import { buildPrompt } from "./prompt";
import { looseReplySchema, proposalSchema, type AssistantMessage, type Proposal } from "./schema";

export type AssistantResponse = {
  reply: string;
  proposals: Proposal[];
  /** claude-pool had no free account (exit 75). */
  busy?: true;
  /** claude-pool failed or the reply could not be understood twice. */
  failed?: true;
};

export const BUSY_REPLY = "Pomočnik je trenutno zaseden. Spremembo lahko naredite tudi na zaslonu.";
export const FAILED_REPLY = "Pomočnik trenutno ne deluje. Spremembo lahko naredite tudi na zaslonu.";
export const UNCLEAR_REPLY = "Tega nisem razumel. Poskusite drugače.";

/** Keep proposals of allowed types that point at items the context actually holds, in a state where the change makes sense. */
export function filterProposals(ctx: AssistantContext, raw: unknown[]): Proposal[] {
  const out: Proposal[] = [];
  const mass = (id: number) => ctx.masses?.find((x) => x.massId === id);
  const lesson = (groupId: number, date: string) => ctx.lessons?.find((x) => x.groupId === groupId && x.date === date);
  const event = (id: number) => ctx.events?.find((x) => x.id === id);
  const keep = (p: Proposal): boolean => {
    switch (p.type) {
      case "add_intention": {
        const m = mass(p.massId);
        return !!m && m.status !== "cancelled";
      }
      case "cancel_mass": {
        const m = mass(p.massId);
        return !!m && m.status !== "cancelled" && !m.past;
      }
      case "restore_mass": {
        const m = mass(p.massId);
        return !!m && m.status === "cancelled" && !m.past;
      }
      case "remove_intention":
        return !!ctx.masses?.some((m) => m.intentions?.some((i) => i.id === p.intentionId));
      case "cancel_lesson": {
        const l = lesson(p.groupId, p.date);
        return !!l && !l.cancelled && !l.past;
      }
      case "restore_lesson": {
        const l = lesson(p.groupId, p.date);
        return !!l && l.cancelled && !l.past;
      }
      case "edit_event":
        return !!event(p.id) && [p.title, p.date, p.time, p.place, p.description].some((v) => v !== undefined);
      case "delete_event":
        return !!event(p.id);
      case "invite_person": {
        const email = p.email.toLowerCase();
        return p.sections.length > 0 && !ctx.people?.some((x) => x.email.toLowerCase() === email);
      }
      case "update_access": {
        const person = ctx.people?.find((x) => x.userId === p.userId);
        return !!person && !person.isOwner;
      }
      case "approve_change":
      case "reject_change":
        return ctx.pending.some((x) => x.changeRequestId === p.changeRequestId);
      case "event":
      case "open_upload":
        return true;
    }
  };
  for (const r of raw) {
    const parsed = proposalSchema.safeParse(r);
    if (!parsed.success) continue;
    const p = parsed.data;
    if (ctx.allowed.includes(p.type) && keep(p)) out.push(p);
  }
  return out;
}

function parseReply(text: string) {
  try {
    const r = looseReplySchema.safeParse(extractJson(text));
    return r.success ? r.data : null;
  } catch {
    return null;
  }
}

export async function askAssistant(actor: Actor, messages: AssistantMessage[], dbx: Db = defaultDb): Promise<AssistantResponse> {
  const ctx = await buildContext(actor, dbx);
  const prompt = buildPrompt(actor, ctx, messages);
  for (let attempt = 0; attempt < 2; attempt++) {
    let text: string;
    try {
      ({ text } = await runClaude({ prompt, allowedTools: [], timeoutMs: 90_000 }));
    } catch (e) {
      if (e instanceof AiBusyError) return { busy: true, reply: BUSY_REPLY, proposals: [] };
      console.error("assistant: claude-pool failed", e);
      return { failed: true, reply: FAILED_REPLY, proposals: [] };
    }
    const reply = parseReply(text);
    if (reply) return { reply: reply.reply, proposals: filterProposals(ctx, reply.proposals) };
  }
  return { failed: true, reply: UNCLEAR_REPLY, proposals: [] };
}
