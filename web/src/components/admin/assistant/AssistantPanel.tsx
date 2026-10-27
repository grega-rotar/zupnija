"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useAssistant } from "../AssistantContext";
import { Icon } from "../Icon";
import { Panel } from "../Panel";
import { useToast } from "../Toast";
import type { Actor } from "@/lib/admin/sections";
import type { AssistantMessage } from "@/lib/assistant/schema";
import { assistantStart, assistantTurn, confirmCard } from "./actions";
import { cardNote, extrasOf, newCard, ProposalCard, type CardState } from "./ProposalCard";

/**
 * The assistant (US-013): a chat that proposes changes as cards and saves
 * nothing until the person confirms a card. Mounted once in the editor
 * layout, so the conversation lives in this component's state for as long
 * as the tab is open (FR-13) and is sent whole with every turn.
 */

type Msg = {
  id: string;
  who: "me" | "ai";
  text: string;
  /** Busy, failed or an error: shown as a refusal (.msg.ai.no). */
  no?: boolean;
  cards?: CardState[];
  /** The reply proposed opening the bulletin upload. */
  upload?: boolean;
};

const UPLOAD = "/oznanila/nalozi";
const FAILED = "Pomočnik trenutno ne deluje. Spremembo lahko naredite tudi na zaslonu.";
const MAX_TURNS = 60;
/** Keep the line breaks people type (Shift+Enter) and the model writes. */
const PRE = { whiteSpace: "pre-wrap" } as const;

let seq = 0;
const nid = (p: string) => `${p}${++seq}`;

/** The prototype's toasts, by proposal type and whether it waits for the owner. */
function toastText(type: CardState["proposal"]["type"], pending: boolean): string {
  switch (type) {
    case "cancel_mass":
      return pending ? "Predlog odpovedi je poslan župniku." : "Shranjeno. Maša je na strani označena, da odpade.";
    case "add_intention":
      return pending ? "Poslano župniku v potrditev." : "Shranjeno. Namen je že na strani.";
    case "cancel_lesson":
      return pending ? "Poslano župniku v potrditev." : "Shranjeno. Starši bodo obvestilo videli na strani Verouk.";
    case "event":
      return pending ? "Poslano župniku v potrditev." : "Shranjeno. Dogodek je na strani.";
    default:
      return "Shranjeno.";
  }
}

/** The conversation as the backend wants it: refusals left out, card outcomes noted. */
function history(msgs: Msg[]): AssistantMessage[] {
  const out: AssistantMessage[] = [];
  for (const m of msgs) {
    if (m.no) continue;
    if (m.who === "me") {
      out.push({ role: "user", text: m.text.slice(0, 4000) });
      continue;
    }
    const notes = (m.cards ?? []).map(cardNote).filter(Boolean);
    out.push({ role: "assistant", text: [m.text, ...notes].join("\n").slice(0, 4000) });
  }
  return out.slice(-MAX_TURNS);
}

export function AssistantPanel({ actor }: { actor: Actor }) {
  const { open, closeAssistant, initial, consumeInitial } = useAssistant();
  const toast = useToast();
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [approval, setApproval] = useState(!actor.isOwner && actor.requiresApproval);
  const [ready, setReady] = useState(false);
  const [typing, setTyping] = useState(false);
  const [draft, setDraft] = useState("");
  const started = useRef(false);
  const threadRef = useRef<HTMLDivElement>(null);

  // Messages that exist when the panel opens don't animate again; new ones do.
  const [enterFrom, setEnterFrom] = useState(0);
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setEnterFrom(msgs.length);
  }

  const canUpload = actor.isOwner || actor.sections.includes("oznanila");

  // First open: the greeting (prototype greet()) and the suggestion chips.
  useEffect(() => {
    if (!open || started.current) return;
    started.current = true;
    let alive = true;
    let done = false;
    (async () => {
      try {
        const s = await assistantStart();
        if (!alive) return;
        setMsgs((m) => [{ id: nid("m"), who: "ai", text: s.greeting }, ...m]);
        setSuggestions(s.suggestions);
        setApproval(s.approval);
      } catch {
        if (!alive) return;
        setMsgs((m) => [{ id: nid("m"), who: "ai", text: "Dober dan." }, ...m]);
      }
      done = true;
      setReady(true);
    })();
    return () => {
      alive = false;
      // Closed before the greeting arrived: fetch it again on the next open.
      if (!done) started.current = false;
    };
  }, [open]);

  async function send(raw: string) {
    const text = raw.trim();
    if (!text || typing) return;
    const mine: Msg = { id: nid("m"), who: "me", text };
    const next = [...msgs, mine];
    setMsgs(next);
    setDraft("");
    setTyping(true);
    let reply: Msg;
    try {
      const r = await assistantTurn(history(next));
      if (r.ok) {
        const cards = r.data.cards.filter((c) => c.proposal.type !== "open_upload").map((c) => newCard(c, nid("c")));
        const upload = r.data.cards.some((c) => c.proposal.type === "open_upload");
        reply = { id: nid("m"), who: "ai", text: r.data.reply, no: r.data.refused || undefined, cards, upload };
      } else {
        reply = { id: nid("m"), who: "ai", text: r.error, no: true };
      }
    } catch {
      reply = { id: nid("m"), who: "ai", text: FAILED, no: true };
    }
    setTyping(false);
    setMsgs((m) => [...m, reply]);
  }

  // Text handed over by openAssistant("…"): sent once the greeting is in.
  useEffect(() => {
    if (!open || !ready || !initial) return;
    const t = consumeInitial();
    // Starting a turn is the point here: the hand-over is an outside request.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (t) void send(t);
    // send() is a fresh closure each render; this runs only when the hand-over arrives.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, ready, initial]);

  // Keep the newest message in view: the bottom of the thread, or the top of a
  // reply that is taller than the thread so its first line isn't scrolled past.
  const firstScroll = useRef(true);
  useEffect(() => {
    if (!open) {
      firstScroll.current = true;
      return;
    }
    const el = threadRef.current;
    if (!el) return;
    const last = el.lastElementChild as HTMLElement | null;
    const max = el.scrollHeight - el.clientHeight;
    let top = max;
    if (last) {
      const offset = el.scrollTop + last.getBoundingClientRect().top - el.getBoundingClientRect().top - 12;
      top = Math.min(max, offset);
    }
    el.scrollTo({ top, behavior: firstScroll.current ? "auto" : "smooth" });
    firstScroll.current = false;
  }, [open, msgs.length, typing]);

  function patchCard(id: string, patch: Partial<CardState>) {
    setMsgs((all) => all.map((m) => (m.cards?.some((c) => c.id === id) ? { ...m, cards: m.cards.map((c) => (c.id === id ? { ...c, ...patch } : c)) } : m)));
  }

  async function confirm(card: CardState) {
    patchCard(card.id, { st: "busy" });
    let res: Awaited<ReturnType<typeof confirmCard>>;
    try {
      res = await confirmCard(card.proposal, extrasOf(card));
    } catch {
      res = { ok: false, error: "Shranjevanje ni uspelo. Poskusite znova." };
    }
    if (!res.ok) {
      patchCard(card.id, { st: "open" });
      toast.show({ text: res.forbidden ? "Tega ne morete spremeniti." : res.error, tone: "error" });
      return;
    }
    patchCard(card.id, { st: "done" });
    const pending = res.data.status === "pending";
    toast.show({ text: toastText(card.proposal.type, pending), historyId: res.data.status === "applied" ? res.data.historyId : null });
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      void send(draft);
    }
  }

  if (!open) return null;
  const finePointer = typeof window !== "undefined" && window.matchMedia("(pointer: fine)").matches;
  return (
    <Panel
      full
      bare
      eyebrow="Pomočnik"
      title="Kaj naj spremenim?"
      sub="Predlaga spremembe, shrani jih šele, ko potrdite."
      label="Pomočnik"
      onClose={closeAssistant}
      autoFocus={finePointer ? "#chat-in" : undefined}
    >
      <div className="chat">
        <div className="thread" ref={threadRef} aria-live="polite" aria-busy={typing || !ready}>
          {msgs.map((m, i) => {
            const en = i >= enterFrom ? " enter" : "";
            if (m.who === "me")
              return (
                <div key={m.id} className={`msg me${en}`} style={PRE}>
                  {m.text}
                </div>
              );
            return (
              <div key={m.id} className={`msg ai${m.no ? " no" : ""}${en}`}>
                <span className="by">
                  <i />
                  Pomočnik
                </span>
                <p style={PRE}>{m.text}</p>
                {m.cards?.map((c) => (
                  <ProposalCard
                    key={c.id}
                    card={c}
                    approval={approval}
                    onChange={(patch) => patchCard(c.id, patch)}
                    onConfirm={() => void confirm(c)}
                    onCancel={() => patchCard(c.id, { st: "gone" })}
                  />
                ))}
                {m.upload && canUpload ? (
                  <div>
                    <Link href={UPLOAD} className="btn primary" onClick={closeAssistant}>
                      <Icon name="cam" />
                      Odpri nalaganje oznanil
                    </Link>
                  </div>
                ) : null}
              </div>
            );
          })}
          {typing || !ready ? (
            <div className="msg ai" aria-label="Pomočnik piše">
              <span className="by">
                <i />
                Pomočnik
              </span>
              <span className="typing">
                <i />
                <i />
                <i />
              </span>
            </div>
          ) : null}
        </div>
        <form
          className="composer"
          onSubmit={(e) => {
            e.preventDefault();
            void send(draft);
          }}
        >
          {suggestions.length ? (
            <div className="sugg">
              {suggestions.map((s) => (
                <button key={s} type="button" onClick={() => void send(s)}>
                  {s}
                </button>
              ))}
            </div>
          ) : null}
          <div className="cin">
            {canUpload ? (
              <Link href={UPLOAD} className="iconbtn" aria-label="Fotografiraj oznanila" onClick={closeAssistant}>
                <Icon name="cam" />
              </Link>
            ) : null}
            <label className="sr" htmlFor="chat-in">
              Sporočilo
            </label>
            <textarea
              id="chat-in"
              rows={1}
              placeholder="npr. odpovej mašo v sredo"
              value={draft}
              maxLength={4000}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={onKeyDown}
            />
            <button className="iconbtn send" type="submit" aria-label="Pošlji">
              <Icon name="send" />
            </button>
          </div>
        </form>
      </div>
    </Panel>
  );
}
