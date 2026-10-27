"use server";
/**
 * The assistant panel's server side: the opening line, one turn with the
 * cards' display details resolved, and confirming a card. The conversation
 * itself lives in the browser (FR-13); these only read or perform.
 */
import "@/lib/admin/next";
import "@/lib/admin/registry";
import { refresh } from "next/cache";
import type { ActionResult } from "@/lib/admin/errors";
import type { PerformResult } from "@/lib/admin/engine";
import { needsApproval } from "@/lib/admin/sections";
import { requireActor } from "@/lib/admin/session";
import { askAssistantAction, confirmProposalAction } from "@/lib/assistant/actions";
import { greeting, suggestions } from "@/lib/assistant/greeting";
import type { AssistantMessage, Proposal } from "@/lib/assistant/schema";
import { weekStart } from "@/lib/clock";
import { getMass } from "@/lib/mase/queries";
import { dayLabel, timeLabel } from "@/lib/mase/format";
import { getLessons } from "@/lib/verouk/queries";
import type { CardDetail, CardProposal, StartData, TurnData } from "./types";

export async function assistantStart(): Promise<StartData> {
  const actor = await requireActor();
  const [text, sugg] = await Promise.all([greeting(actor), suggestions(actor)]);
  return { greeting: text, suggestions: sugg, approval: needsApproval(actor) };
}

/** What the card shows next to the proposal ("sreda, 28. oktober, 18.30, Sv. Križ"). */
async function detail(p: Proposal): Promise<CardDetail | null> {
  switch (p.type) {
    case "add_intention":
    case "cancel_mass": {
      const m = await getMass(p.massId);
      if (!m) return null;
      return {
        when: `${m.label}, ${timeLabel(m.time)}, ${m.church}`,
        intentions: m.intentions.map((i) => ({ kind: i.kind, text: i.text })),
      };
    }
    case "cancel_lesson": {
      const l = (await getLessons(weekStart(p.date))).find((x) => x.groupId === p.groupId && x.date === p.date);
      if (!l) return null;
      return { when: `${dayLabel(l.date)}, ${timeLabel(l.time)}`, name: l.name };
    }
    case "event":
      return { when: `${dayLabel(p.date)}, ${timeLabel(p.time)}, ${p.place}` };
    case "open_upload":
      return { when: "" };
  }
}

export async function assistantTurn(messages: AssistantMessage[]): Promise<ActionResult<TurnData>> {
  const res = await askAssistantAction(messages);
  if (!res.ok) return res;
  const { reply, proposals, busy, failed } = res.data;
  const cards: CardProposal[] = [];
  for (const proposal of proposals) {
    const d = await detail(proposal);
    // A proposal pointing at something that's gone is dropped, not shown half-empty.
    if (d) cards.push({ proposal, detail: d });
  }
  return { ok: true, data: { reply, cards, refused: !!(busy || failed) } };
}

export async function confirmCard(proposal: Proposal, extras: Record<string, unknown>): Promise<ActionResult<PerformResult>> {
  const res = await confirmProposalAction(proposal, extras);
  if (res.ok) refresh();
  return res;
}
