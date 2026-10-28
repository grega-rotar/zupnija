"use client";

import { kindPrefix } from "@/lib/mase/format";
import { btnClass, Pill } from "@/components/admin/ui";
import type { Proposal } from "@/lib/assistant/schema";
import type { CardProposal } from "./types";

export type Kind = "deceased" | "thanksgiving" | "other";
export type CardState = CardProposal & {
  id: string;
  /** open → busy (saving) → done, or open → gone (Prekliči). */
  st: "open" | "busy" | "done" | "gone";
  /** cancel_mass: the reason on the page. */
  reason: string;
  /** cancel_lesson: the message to parents. */
  message: string;
  /** cancel_mass: what happens with the intentions (null until chosen). */
  move: "next" | "keep" | null;
  /** add_intention: the kind (the guess until the person picks). */
  kind: Kind;
};

export function newCard(c: CardProposal, id: string): CardState {
  const p = c.proposal;
  return {
    ...c,
    id,
    st: "open",
    reason: p.type === "cancel_mass" ? (p.reason ?? "") : "",
    message: p.type === "cancel_lesson" ? (p.message ?? "") : "",
    move: null,
    kind: p.type === "add_intention" ? p.kind : "deceased",
  };
}

const KINDS: [Kind, string][] = [
  ["deceased", "† Za pokojne"],
  ["thanksgiving", "Zahvala"],
  ["other", "Za žive / drugo"],
];
const GUESS: Record<Kind, string> = {
  deceased: "Sem prav razumel, da je za pokojnega?",
  thanksgiving: "Sem prav razumel, da je zahvala?",
  other: "Sem prav razumel, da je za žive?",
};

/** cancel_mass needs an answer about the intentions before it can be confirmed. */
export const needsMove = (c: CardState) => c.proposal.type === "cancel_mass" && !!c.detail.intentions?.length && !c.move;

/** What the card's Potrdi sends along (ConfirmExtras). */
export function extrasOf(c: CardState): Record<string, unknown> {
  switch (c.proposal.type) {
    case "cancel_mass":
      return { reason: c.reason, ...(c.move ? { intentionHandling: c.move } : {}) };
    case "cancel_lesson":
      return { message: c.message };
    case "add_intention":
      return { kind: c.kind };
    default:
      return {};
  }
}

/** One sentence the model gets back on the next turn, so it knows what happened to its proposal. */
export function cardNote(c: CardState): string | null {
  if (c.st === "done") return "[Predlog je potrjen in shranjen.]";
  if (c.st === "gone") return "[Predlog je preklican.]";
  return null;
}

function intentionsQuestion(list: NonNullable<CardState["detail"]["intentions"]>): string {
  if (list.length === 1) return `Maša ima namen ${kindPrefix(list[0].kind)} ${list[0].text}. Kaj naj bo z njim?`;
  const n = list.length;
  const forms = n % 100 === 2 ? "namena" : n % 100 === 3 || n % 100 === 4 ? "namene" : "namenov";
  const names = list.map((i) => `${kindPrefix(i.kind)} ${i.text}`).join(", ");
  return `Maša ima ${n} ${forms}: ${names}. Kaj naj bo z ${n === 2 ? "njima" : "njimi"}?`;
}

function Body({ c, p, closed, onChange }: { c: CardState; p: Proposal; closed: boolean; onChange: (patch: Partial<CardState>) => void }) {
  const fieldId = `cr-${c.id}`;
  switch (p.type) {
    case "cancel_mass": {
      const list = c.detail.intentions ?? [];
      return (
        <>
          <div className="chg minus">
            <span className="s">−</span>
            <b>Maša odpade</b>
            <small>{c.detail.when}</small>
          </div>
          {closed ? (
            c.reason.trim() ? <p className="wsum">»{c.reason.trim()}«</p> : null
          ) : (
            <label className="field" htmlFor={fieldId}>
              <span>Razlog na strani (ni obvezno)</span>
              <input id={fieldId} value={c.reason} maxLength={200} placeholder="npr. Župnik je odsoten." onChange={(e) => onChange({ reason: e.target.value })} disabled={c.st === "busy"} />
            </label>
          )}
          {!closed && list.length ? (
            <div className="q">
              <p>{intentionsQuestion(list)}</p>
              <div className="chips" role="group" aria-label="Kaj naj bo z namenom">
                <button type="button" className="chip" aria-pressed={c.move === "next"} onClick={() => onChange({ move: "next" })} disabled={c.st === "busy"}>
                  Prestavi na naslednjo mašo
                </button>
                <button type="button" className="chip" aria-pressed={c.move === "keep"} onClick={() => onChange({ move: "keep" })} disabled={c.st === "busy"}>
                  Pusti
                </button>
              </div>
            </div>
          ) : null}
        </>
      );
    }
    case "add_intention":
      return (
        <>
          <div className="chg">
            <span className="s">+</span>
            <b>
              {kindPrefix(c.kind)} {p.text}
            </b>
            <small>{c.detail.when}</small>
          </div>
          {!closed && p.kindIsGuess ? (
            <div className="q">
              <p>{GUESS[p.kind]}</p>
              <div className="chips" role="group" aria-label="Vrsta namena">
                {KINDS.map(([v, l]) => (
                  <button key={v} type="button" className="chip" aria-pressed={c.kind === v} onClick={() => onChange({ kind: v })} disabled={c.st === "busy"}>
                    {l}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </>
      );
    case "cancel_lesson":
      return (
        <>
          <div className="chg minus">
            <span className="s">−</span>
            <b>Verouk {c.detail.name} odpade</b>
            <small>{c.detail.when}</small>
          </div>
          {closed ? null : (
            <label className="field" htmlFor={fieldId}>
              <span>Sporočilo staršem</span>
              <input id={fieldId} value={c.message} maxLength={500} placeholder="npr. Zaradi počitnic." onChange={(e) => onChange({ message: e.target.value })} disabled={c.st === "busy"} />
            </label>
          )}
        </>
      );
    case "event":
      return (
        <>
          <div className="chg">
            <span className="s">+</span>
            <b>{p.title}</b>
            <small>{c.detail.when}</small>
          </div>
          {p.description ? <p className="wsum">{p.description}</p> : null}
        </>
      );
    default:
      return null;
  }
}

/** The prototype's cardEl(): Predlog → Shranjeno / Preklicano. */
export function ProposalCard({ card, approval, onChange, onConfirm, onCancel }: {
  card: CardState;
  approval: boolean;
  onChange: (patch: Partial<CardState>) => void;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const closed = card.st === "done" || card.st === "gone";
  const busy = card.st === "busy";
  const blocked = needsMove(card);
  const label = blocked ? "Najprej izberite zgoraj" : busy ? "Shranjujem …" : approval ? "Pošlji v potrditev" : "Potrdi";
  return (
    <div className={`card${card.st === "done" ? " closed" : card.st === "gone" ? " gone" : ""}`}>
      <div className="card-h">
        <span className="eyebrow">{card.st === "done" ? "Shranjeno" : card.st === "gone" ? "Preklicano" : "Predlog"}</span>
        {closed ? null : <Pill tone="line">še ni shranjeno</Pill>}
      </div>
      <div className="card-b">
        <Body c={card} p={card.proposal} closed={closed} onChange={onChange} />
      </div>
      {closed ? null : (
        <div className="card-f">
          <button type="button" className={btnClass({ variant: "primary" })} onClick={onConfirm} disabled={blocked || busy} aria-busy={busy || undefined}>
            {label}
          </button>
          <button type="button" className={btnClass({ variant: "ghost" })} onClick={onCancel} disabled={busy}>
            Prekliči
          </button>
        </div>
      )}
    </div>
  );
}
