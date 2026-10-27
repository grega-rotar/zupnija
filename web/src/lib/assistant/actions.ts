"use server";
/**
 * Server actions for the assistant panel. The conversation lives in the
 * browser (FR-13) and is sent whole with every turn.
 */
import "@/lib/admin/next";
import "@/lib/admin/registry";
import { toResult, UserError, type ActionResult } from "@/lib/admin/errors";
import type { PerformResult } from "@/lib/admin/engine";
import { requireActor } from "@/lib/admin/session";
import { askAssistant, type AssistantResponse } from "./ask";
import { confirmProposal } from "./confirm";
import { messagesSchema } from "./schema";

export async function askAssistantAction(messages: unknown): Promise<ActionResult<AssistantResponse>> {
  const actor = await requireActor();
  return toResult(async () => {
    const parsed = messagesSchema.safeParse(messages);
    if (!parsed.success) throw new UserError("Sporočilo je predolgo ali prazno.");
    return askAssistant(actor, parsed.data);
  });
}

export async function confirmProposalAction(proposal: unknown, extras?: unknown): Promise<ActionResult<PerformResult>> {
  const actor = await requireActor();
  return toResult(() => confirmProposal(actor, proposal, extras ?? {}));
}
