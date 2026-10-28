"use client";

import { useRef, useState, useTransition } from "react";
import { addIntention } from "@/app/admin/(app)/teden/actions";
import { Panel } from "@/components/admin/Panel";
import { useToast } from "@/components/admin/Toast";
import { Button, Chip } from "@/components/admin/ui";
import type { IntentionKind } from "@/lib/mase/format";
import type { MassView } from "@/lib/mase/queries";
import { FieldError, fieldOf } from "./FieldError";
import { fT, KINDS } from "./format";
import { markChanged } from "./useTedenUrl";
import type { Viewer } from "./WeekView";

export type UpcomingMass = MassView & { label: string };

/** A visitor's request being written down as an intention (Prošnje): prefills the panel. */
export type IntentionPrefill = { requestId: number; massId?: number; text: string; kind: IntentionKind; from: string };

/** "Nov namen" (the prototype's pIntent): pick an upcoming Mass, grouped by day. */
export function IntentionPanel({ masses, viewer, onClose, prefill, onSaved }: {
  masses: UpcomingMass[];
  viewer: Viewer;
  onClose: () => void;
  prefill?: IntentionPrefill;
  onSaved?: () => void;
}) {
  const toast = useToast();
  const [busy, startTransition] = useTransition();
  const [mid, setMid] = useState<number | undefined>(prefill?.massId ?? masses[0]?.id);
  const [text, setText] = useState(prefill?.text ?? "");
  const [kind, setKind] = useState<IntentionKind>(prefill?.kind ?? "deceased");
  const [err, setErr] = useState<string | undefined>();
  const textRef = useRef<HTMLInputElement>(null);
  const ask = viewer.approval;

  const byDay: Array<[string, UpcomingMass[]]> = [];
  for (const m of masses) {
    const last = byDay[byDay.length - 1];
    if (last && last[1][0].date === m.date) last[1].push(m);
    else byDay.push([m.label, [m]]);
  }

  const save = () => {
    if (!mid) return;
    if (!text.trim()) {
      setErr("Vpišite, za koga je namen.");
      textRef.current?.focus();
      return;
    }
    startTransition(async () => {
      const r = await addIntention(mid, text, kind, prefill?.requestId);
      if (!r.ok) {
        if (fieldOf(r.error)) setErr(r.error);
        else toast.show({ text: r.error === "forbidden" ? "Tega ne morete spremeniti." : r.error, tone: "error" });
        return;
      }
      markChanged();
      toast.show({ text: r.data.pending ? "Poslano župniku v potrditev." : "Shranjeno. Namen je že na strani.", historyId: r.data.historyId });
      onSaved?.();
      onClose();
    });
  };

  return (
    <Panel
      eyebrow="Maše in nameni"
      title="Nov namen"
      sub={prefill ? `Prošnja: ${prefill.from}` : "Izberite mašo in vpišite, za koga se daruje."}
      onClose={onClose}
      footer={
        <>
          <Button variant="primary" size="lg" disabled={busy || !mid} onClick={save}>
            {ask ? "Pošlji v potrditev" : "Dodaj namen"}
          </Button>
          <Button variant="ghost" size="lg" onClick={onClose}>
            Prekliči
          </Button>
        </>
      }
    >
      <label className="field">
        <span>Maša</span>
        <select value={mid ?? ""} onChange={(e) => setMid(Number(e.target.value))}>
          {byDay.map(([label, ms]) => (
            <optgroup key={label} label={label}>
              {ms.map((m) => {
                const n = m.intentions.length + m.pending.length;
                return (
                  <option key={m.id} value={m.id}>
                    {fT(m.time)} · {m.church}
                    {n ? ` (${n})` : " · brez namena"}
                  </option>
                );
              })}
            </optgroup>
          ))}
        </select>
      </label>
      <label className="field">
        <span>Za koga</span>
        <input
          ref={textRef}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            if (err) setErr(undefined);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              save();
            }
          }}
          placeholder="npr. Jože Novak"
          autoComplete="off"
          aria-invalid={err ? true : undefined}
          aria-describedby={err ? "np-text-err" : undefined}
        />
        <FieldError id="np-text-err" text={err} />
      </label>
      <div className="field">
        <span>Vrsta</span>
        <div className="chips">
          {KINDS.map(([v, l]) => (
            <Chip key={v} pressed={kind === v} onClick={() => setKind(v)}>
              {l}
            </Chip>
          ))}
        </div>
      </div>
      {ask ? (
        <div className="banner gold">
          <p>Namen bo na strani, ko ga potrdi župnik.</p>
        </div>
      ) : null}
    </Panel>
  );
}
