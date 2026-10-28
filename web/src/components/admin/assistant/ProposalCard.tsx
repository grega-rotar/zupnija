"use client";

import { kindPrefix } from "@/lib/mase/format";
import { btnClass, Chip, Pill, Switch } from "@/components/admin/ui";
import { SECTION_LABEL, SECTIONS, type Section } from "@/lib/admin/sections";
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
  /** invite_person / update_access: the sections as set on the card. */
  sections: Section[];
  /** invite_person / update_access: "Spremembe potrdim jaz". */
  approve: boolean;
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
    sections: p.type === "invite_person" || p.type === "update_access" ? SECTIONS.filter((x) => p.sections.includes(x)) : [],
    approve: p.type === "invite_person" || p.type === "update_access" ? p.requiresApproval : false,
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
/** An invitation needs at least one section. */
export const needsSection = (c: CardState) => c.proposal.type === "invite_person" && !c.sections.length;

/** What the card's Potrdi sends along (ConfirmExtras). */
export function extrasOf(c: CardState): Record<string, unknown> {
  switch (c.proposal.type) {
    case "cancel_mass":
      return { reason: c.reason, ...(c.move ? { intentionHandling: c.move } : {}) };
    case "cancel_lesson":
      return { message: c.message };
    case "add_intention":
      return { kind: c.kind };
    case "invite_person":
    case "update_access":
      return { sections: c.sections, requiresApproval: c.approve };
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
    case "remove_intention":
      return (
        <div className="chg minus">
          <span className="s">−</span>
          <b>
            Odstrani namen {kindPrefix(c.detail.kind ?? "other")} {c.detail.name}
          </b>
          <small>{c.detail.when}</small>
        </div>
      );
    case "restore_mass":
      return (
        <div className="chg">
          <span className="s">+</span>
          <b>Maša je spet na urniku</b>
          <small>{c.detail.when}</small>
        </div>
      );
    case "restore_lesson":
      return (
        <div className="chg">
          <span className="s">+</span>
          <b>Verouk {c.detail.name} je spet na urniku</b>
          <small>{c.detail.when}</small>
        </div>
      );
    case "edit_event":
      return (
        <>
          <div className="chg minus">
            <span className="s">−</span>
            <b>Prej</b>
            <small>{c.detail.before}</small>
          </div>
          <div className="chg">
            <span className="s">+</span>
            <b>{c.detail.name}</b>
            <small>{c.detail.when}</small>
          </div>
          {p.description ? <p className="wsum">{p.description}</p> : null}
        </>
      );
    case "delete_event":
      return (
        <div className="chg minus">
          <span className="s">−</span>
          <b>Izbriši dogodek {c.detail.name}</b>
          <small>{c.detail.when}</small>
        </div>
      );
    case "invite_person":
    case "update_access": {
      const toggle = (s: Section) =>
        onChange({ sections: SECTIONS.filter((x) => (x === s ? !c.sections.includes(s) : c.sections.includes(x))) });
      const invite = p.type === "invite_person";
      return (
        <>
          <div className="chg">
            <span className="s">{invite ? "+" : "~"}</span>
            <b>{invite ? `Povabilo: ${c.detail.name}${p.title ? `, ${p.title}` : ""}` : `Dostop za ${c.detail.name}`}</b>
            <small>{c.detail.when}</small>
          </div>
          {!invite && c.detail.sections ? (
            <p className="wsum">
              Zdaj: {c.detail.sections.length ? c.detail.sections.map((x) => SECTION_LABEL[x]).join(", ") : "nič"}
              {c.detail.requiresApproval ? ", spremembe potrdite vi" : ""}
            </p>
          ) : null}
          {closed ? (
            <p className="wsum">
              {c.sections.map((x) => SECTION_LABEL[x]).join(", ") || "nič"}
              {c.approve ? ", spremembe potrdite vi" : ""}
            </p>
          ) : (
            <>
              <div className="q">
                <p>Kaj sme urejati?</p>
                <div className="chips" role="group" aria-label="Kaj sme urejati">
                  {SECTIONS.map((x) => (
                    <Chip key={x} pressed={c.sections.includes(x)} onClick={() => toggle(x)} disabled={c.st === "busy"}>
                      {SECTION_LABEL[x]}
                    </Chip>
                  ))}
                </div>
              </div>
              <Switch
                label="Spremembe potrdim jaz"
                hint="Na strani so šele, ko jih potrdite."
                checked={c.approve}
                onChange={(approve) => onChange({ approve })}
                disabled={c.st === "busy"}
              />
              {invite ? <p className="wsum">Po e-pošti dobi povezavo za prijavo.</p> : null}
            </>
          )}
        </>
      );
    }
    case "approve_change":
    case "reject_change": {
      const ok = p.type === "approve_change";
      return (
        <div className={`chg${ok ? "" : " minus"}`}>
          <span className="s">{ok ? "+" : "−"}</span>
          <b>
            {ok ? "Potrdi" : "Zavrni"}: {c.detail.name}
          </b>
          <small>{c.detail.by}</small>
        </div>
      );
    }
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
  const blocked = needsMove(card) || needsSection(card);
  const type = card.proposal.type;
  // Owner-only actions are never queued, so they never say "Pošlji v potrditev".
  const ownerOnly = type === "delete_event" || type === "invite_person" || type === "update_access" || type === "approve_change" || type === "reject_change";
  const label = blocked
    ? needsSection(card)
      ? "Izberite vsaj en razdelek"
      : "Najprej izberite zgoraj"
    : busy
      ? "Shranjujem …"
      : approval && !ownerOnly
        ? "Pošlji v potrditev"
        : type === "invite_person"
          ? "Pošlji povabilo"
          : type === "reject_change"
            ? "Zavrni"
            : "Potrdi";
  return (
    <div className={`card${card.st === "done" ? " closed" : card.st === "gone" ? " gone" : ""}`}>
      <div className="card-h">
        <span className="eyebrow">{card.st === "done" ? (card.proposal.type === "reject_change" ? "Zavrnjeno" : "Shranjeno") : card.st === "gone" ? "Preklicano" : "Predlog"}</span>
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
