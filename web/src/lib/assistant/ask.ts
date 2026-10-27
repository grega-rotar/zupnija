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

/** Keep proposals of allowed types that point at open, future items in the context. */
export function filterProposals(ctx: AssistantContext, raw: unknown[]): Proposal[] {
  const out: Proposal[] = [];
  for (const r of raw) {
    const parsed = proposalSchema.safeParse(r);
    if (!parsed.success) continue;
    const p = parsed.data;
    if (!ctx.allowed.includes(p.type)) continue;
    if (p.type === "add_intention" || p.type === "cancel_mass") {
      const m = ctx.masses?.find((x) => x.massId === p.massId);
      if (!m || m.status === "cancelled") continue;
      if (p.type === "cancel_mass" && m.past) continue;
    }
    if (p.type === "cancel_lesson") {
      const l = ctx.lessons?.find((x) => x.groupId === p.groupId && x.date === p.date);
      if (!l || l.cancelled || l.past) continue;
    }
    out.push(p);
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
