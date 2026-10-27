"use client";

import { useRef, useState, useTransition } from "react";
import { addIntention, cancelMass, removeIntention, restoreMass, withdrawIntention, type MassChange } from "@/app/admin/(app)/teden/actions";
import { Panel } from "@/components/admin/Panel";
import { useToast } from "@/components/admin/Toast";
import { Button, Chip, IconButton } from "@/components/admin/ui";
import type { ActionResult } from "@/lib/admin/errors";
import type { IntentionKind } from "@/lib/mase/format";
import type { MassView } from "@/lib/mase/queries";
import { FieldError, fieldOf } from "./FieldError";
import { fT, KINDS, kindPrefix, typeLong } from "./format";
import { markChanged } from "./useTedenUrl";
import type { Viewer } from "./WeekView";

export type PanelMass = MassView & { label: string; feast: string | null };

type Move = "next" | "keep";

/** One Mass (the prototype's pMass): intentions, add one, cancel or restore. */
export function MassPanel({ mass: m, viewer, onClose }: { mass: PanelMass; viewer: Viewer; onClose: () => void }) {
  const toast = useToast();
  const [busy, startTransition] = useTransition();
  const [text, setText] = useState("");
  const [kind, setKind] = useState<IntentionKind>("deceased");
  const [cancel, setCancel] = useState(false);
  const [reason, setReason] = useState("");
  const [move, setMove] = useState<Move | null>(null);
  const [err, setErr] = useState<{ text?: string; reason?: string }>({});
  const textRef = useRef<HTMLInputElement>(null);

  const off = m.status === "cancelled";
  const ask = viewer.approval;
  const hasIntentions = m.intentions.length + m.pending.length > 0;

  /** Run an action; on success a toast (with Razveljavi when applied), on error the message inline or as a toast. */
  const act = (call: () => Promise<ActionResult<MassChange>>, done: (r: MassChange) => string, field?: "text" | "reason", after?: () => void) =>
    startTransition(async () => {
      const r = await call();
      if (!r.ok) {
        const f = field && fieldOf(r.error);
        if (f) setErr({ [field]: r.error });
        else toast.show({ text: r.error === "forbidden" ? "Tega ne morete spremeniti." : r.error, tone: "error" });
        return;
      }
      markChanged();
      setErr({});
      toast.show({ text: done(r.data), historyId: r.data.historyId });
      after?.();
    });

  const add = () => {
    if (!text.trim()) {
      setErr({ text: "Vpišite, za koga je namen." });
      textRef.current?.focus();
      return;
    }
    act(
      () => addIntention(m.id, text, kind),
      (d) => (d.pending ? "Poslano župniku v potrditev." : "Shranjeno. Namen je že na strani."),
      "text",
      () => setText(""),
    );
  };

  const doCancel = () =>
    act(
      () => cancelMass(m.id, reason, hasIntentions ? move : null),
      (d) => (d.pending ? "Predlog odpovedi je poslan župniku." : "Shranjeno. Maša je na strani označena, da odpade."),
      "reason",
      onClose,
    );

  const body: React.ReactNode[] = [];
  if (m.pendingCancel)
    body.push(
      <div className="banner gold" key="pc">
        <b>Odpoved čaka potrditev</b>
        <p>
          {m.pendingCancel.createdByName}
          {m.pendingCancel.reason ? `: »${m.pendingCancel.reason}«` : ""}
        </p>
      </div>,
    );
  if (off)
    body.push(
      <div className="banner alert" key="off">
        <b>Ta maša odpade</b>
        {m.cancelReason ? <p>{m.cancelReason}</p> : null}
        {viewer.isOwner ? (
          <div className="acts">
            <Button
              size="sm"
              icon="undo"
              disabled={busy}
              onClick={() => act(() => restoreMass(m.id), () => "Maša je spet na urniku.")}
            >
              Vrni mašo na urnik
            </Button>
          </div>
        ) : null}
      </div>,
    );
  if (!off) {
    body.push(
      <div className="blk" key="ints">
        <h3>Nameni</h3>
        <ul className="ilist">
          {!hasIntentions ? <li className="empty">Ta maša še nima namena.</li> : null}
          {m.intentions.map((i) => (
            <li key={i.id}>
              <span className="pre">{kindPrefix(i.kind)}</span>
              <span>{i.text}</span>
              {viewer.isOwner ? (
                <IconButton
                  icon="x"
                  label={`Odstrani namen ${i.text}`}
                  disabled={busy}
                  onClick={() => act(() => removeIntention(i.id), () => "Namen je odstranjen.")}
                />
              ) : null}
            </li>
          ))}
          {m.pending.map((p) => (
            <li key={`p${p.changeRequestId}`}>
              <span className="pre">{kindPrefix(p.kind)}</span>
              <span>{p.text}</span>
              <span className="pill gold">čaka</span>
              {p.createdBy === viewer.id ? (
                <IconButton
                  icon="x"
                  label={`Odstrani namen ${p.text}`}
                  disabled={busy}
                  onClick={() => act(() => withdrawIntention(p.changeRequestId), () => "Namen je odstranjen.")}
                />
              ) : null}
            </li>
          ))}
        </ul>
      </div>,
    );
    body.push(
      <div className="addbox" key="add">
        <label className="field">
          <span>Nov namen</span>
          <input
            ref={textRef}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              if (err.text) setErr({});
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                add();
              }
            }}
            placeholder="npr. Jože Novak"
            autoComplete="off"
            aria-invalid={err.text ? true : undefined}
            aria-describedby={err.text ? `mp-text-err-${m.id}` : undefined}
          />
          <FieldError id={`mp-text-err-${m.id}`} text={err.text} />
        </label>
        <div className="chips" role="group" aria-label="Vrsta namena">
          {KINDS.map(([v, l]) => (
            <Chip key={v} pressed={kind === v} onClick={() => setKind(v)}>
              {l}
            </Chip>
          ))}
        </div>
        <Button variant="primary" icon={ask ? "send" : "plus"} disabled={busy} onClick={add}>
          {ask ? "Pošlji v potrditev" : "Dodaj namen"}
        </Button>
      </div>,
    );
  }
  if (!off && !m.pendingCancel && cancel)
    body.push(
      <div className="banner alert" key="cancel">
        <b>Odpoved maše</b>
        <label className="field">
          <span>Razlog, ki bo na strani</span>
          <input
            value={reason}
            onChange={(e) => {
              setReason(e.target.value);
              if (err.reason) setErr({});
            }}
            placeholder="npr. Župnik je na duhovnih vajah."
            aria-invalid={err.reason ? true : undefined}
          />
          {err.reason ? <FieldError text={err.reason} /> : <small>Ni obvezno.</small>}
        </label>
        {hasIntentions ? (
          <div className="field">
            <span>Kaj naj bo z namenom?</span>
            <div className="chips">
              <Chip pressed={move === "next"} onClick={() => setMove("next")}>
                Prestavi na naslednjo mašo
              </Chip>
              <Chip pressed={move === "keep"} onClick={() => setMove("keep")}>
                Pusti, dogovorim se sam
              </Chip>
            </div>
          </div>
        ) : null}
        <div className="acts">
          <Button variant="danger" style={{ background: "var(--paper)" }} disabled={busy || (hasIntentions && !move)} onClick={doCancel}>
            {ask ? "Predlagaj odpoved" : "Potrdi odpoved"}
          </Button>
          <Button variant="ghost" onClick={() => setCancel(false)}>
            Nazaj
          </Button>
        </div>
      </div>,
    );

  const footer =
    !off && !m.pendingCancel && !cancel ? (
      <>
        <Button variant="danger" icon="ban" onClick={() => setCancel(true)}>
          {ask ? "Predlagaj odpoved" : "Odpovej mašo"}
        </Button>
        <Button variant="ghost" onClick={onClose}>
          Zapri
        </Button>
      </>
    ) : null;

  return (
    <Panel
      eyebrow={`${m.feast ? `${m.feast} · ` : ""}${m.label}`}
      title={`${fT(m.time)} · ${m.church}`}
      sub={typeLong(m.type)}
      onClose={onClose}
      footer={footer}
    >
      {body}
    </Panel>
  );
}
