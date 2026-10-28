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
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { needsApproval } from "@/lib/admin/sections";
import { requireActor } from "@/lib/admin/session";
import { askAssistantAction, confirmProposalAction } from "@/lib/assistant/actions";
import { greeting, suggestions } from "@/lib/assistant/greeting";
import type { ConfirmResult } from "@/lib/assistant/confirm";
import type { AssistantMessage, Proposal } from "@/lib/assistant/schema";
import { weekStart } from "@/lib/clock";
import { getMass } from "@/lib/mase/queries";
import { dayLabel, timeLabel } from "@/lib/mase/format";
import { getLessons } from "@/lib/verouk/queries";
import { getPerson } from "@/lib/ljudje/queries";
import { clock, dayLabel as historyDay } from "@/lib/zgodovina/time";
import type { CardDetail, CardProposal, StartData, TurnData } from "./types";

export async function assistantStart(): Promise<StartData> {
  const actor = await requireActor();
  const [text, sugg] = await Promise.all([greeting(actor), suggestions(actor)]);
  return { greeting: text, suggestions: sugg, approval: needsApproval(actor) };
}

/** What the card shows next to the proposal ("sreda, 28. oktober, 18.30, Sv. Križ"). */
async function detail(p: Proposal): Promise<CardDetail | null> {
  const eventWhen = (e: { date: string; time: string; place: string }) => `${dayLabel(e.date)}, ${timeLabel(e.time)}, ${e.place}`;
  switch (p.type) {
    case "add_intention":
    case "cancel_mass":
    case "restore_mass": {
      const m = await getMass(p.massId);
      if (!m) return null;
      return {
        when: `${m.label}, ${timeLabel(m.time)}, ${m.church}`,
        intentions: m.intentions.map((i) => ({ kind: i.kind, text: i.text })),
      };
    }
    case "remove_intention": {
      const [it] = await db.select().from(schema.intentions).where(eq(schema.intentions.id, p.intentionId));
      const m = it ? await getMass(it.massId) : null;
      if (!it || !m) return null;
      return { when: `${m.label}, ${timeLabel(m.time)}, ${m.church}`, name: it.text, kind: it.kind };
    }
    case "cancel_lesson":
    case "restore_lesson": {
      const l = (await getLessons(weekStart(p.date))).find((x) => x.groupId === p.groupId && x.date === p.date);
      if (!l) return null;
      return { when: `${dayLabel(l.date)}, ${timeLabel(l.time)}`, name: l.name };
    }
    case "event":
      return { when: eventWhen(p) };
    case "edit_event":
    case "delete_event": {
      const ev = schema.events;
      const [e] = await db.select({ title: ev.title, date: ev.date, time: ev.time, place: ev.place }).from(ev).where(eq(ev.id, p.id));
      if (!e) return null;
      if (p.type === "delete_event") return { when: eventWhen(e), name: e.title };
      const after = { date: p.date ?? e.date, time: p.time ?? e.time, place: p.place ?? e.place };
      return { when: eventWhen(after), name: p.title ?? e.title, before: `${e.title}, ${eventWhen(e)}` };
    }
    case "open_upload":
      return { when: "" };
    case "invite_person":
      return { when: p.email, name: p.name };
    case "update_access": {
      const person = await getPerson(p.userId);
      if (!person || person.isOwner) return null;
      return { when: person.email, name: person.name, sections: person.sections, requiresApproval: person.requiresApproval };
    }
    case "approve_change":
    case "reject_change": {
      const cr = schema.changeRequests;
      const [row] = await db
        .select({ label: cr.label, status: cr.status, createdAt: cr.createdAt, by: schema.user.name })
        .from(cr)
        .leftJoin(schema.user, eq(schema.user.id, cr.createdBy))
        .where(eq(cr.id, p.changeRequestId));
      if (!row || row.status !== "pending") return null;
      return { when: "", name: row.label, by: `predlog: ${row.by ?? "?"}, ${historyDay(row.createdAt).toLowerCase()} ob ${clock(row.createdAt)}` };
    }
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

export async function confirmCard(proposal: Proposal, extras: Record<string, unknown>): Promise<ActionResult<ConfirmResult>> {
  const res = await confirmProposalAction(proposal, extras);
  if (res.ok) refresh();
  return res;
}
