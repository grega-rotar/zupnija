"use client";

import { useState, useTransition } from "react";
import { IntentionPanel, type IntentionPrefill, type UpcomingMass } from "@/components/admin/mase/IntentionPanel";
import type { Viewer } from "@/components/admin/mase/WeekView";
import { Panel } from "@/components/admin/Panel";
import { useToast } from "@/components/admin/Toast";
import { Button, Field, Pill } from "@/components/admin/ui";
import { formatDate } from "@/lib/dates";
import type { IntentionKind } from "@/lib/mase/format";
import { declineIntentionRequest } from "./actions";
import s from "./requests.module.css";

export type RequestRow = {
  id: number;
  name: string;
  contact: string;
  text: string;
  preferredDate: string | null;
  church: string | null;
  note: string | null;
  /** "27. 10. 2026" */
  at: string;
  pendingBy: string | null;
  /** The prefill for "Vpiši kot namen": the Mass on the wished date and church, text and kind. */
  prefill: { massId?: number; text: string; kind: IntentionKind };
};

const contactHref = (c: string) => (c.includes("@") ? `mailto:${c}` : `tel:${c.replace(/[^\d+]/g, "")}`);

/** Maše in nameni → Prošnje: visitors' requests, each written down as an intention or declined. */
export function IntentionRequests({ rows, masses, viewer }: { rows: RequestRow[]; masses: UpcomingMass[]; viewer: Viewer }) {
  const [convert, setConvert] = useState<IntentionPrefill | null>(null);
  const [decline, setDecline] = useState<RequestRow | null>(null);

  if (!rows.length)
    return (
      <div className="calm">
        <h3>Ni novih prošenj.</h3>
        <p>Ko kdo na strani prosi za mašni namen, bo prošnja tukaj.</p>
      </div>
    );

  return (
    <>
      <ul className={s.list}>
        {rows.map((r) => (
          <li key={r.id} className={s.req}>
            <div>
              <h3>{r.text}</h3>
              <p className={s.meta}>
                {[r.preferredDate ? `želi ${formatDate(r.preferredDate)}` : "datum ni izbran", r.church].filter(Boolean).join(" · ")}
              </p>
              <p className={s.meta}>
                {r.name} ·{" "}
                <a href={contactHref(r.contact)} className="underline underline-offset-2">
                  {r.contact}
                </a>{" "}
                · poslano {r.at}
              </p>
              {r.note ? <p className={s.note}>»{r.note}«</p> : null}
            </div>
            <div className={s.acts}>
              {r.pendingBy ? (
                <Pill tone="gold">čaka potrditev · {r.pendingBy}</Pill>
              ) : (
                <>
                  <Button
                    size="sm"
                    variant="primary"
                    icon="plus"
                    onClick={() => setConvert({ requestId: r.id, ...r.prefill, from: `${r.name}, ${r.contact}` })}
                  >
                    Vpiši kot namen
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setDecline(r)}>
                    Zavrni
                  </Button>
                </>
              )}
            </div>
          </li>
        ))}
      </ul>
      {convert ? <IntentionPanel key={convert.requestId} masses={masses} viewer={viewer} prefill={convert} onClose={() => setConvert(null)} /> : null}
      {decline ? <DeclinePanel row={decline} onClose={() => setDecline(null)} /> : null}
    </>
  );
}

function DeclinePanel({ row, onClose }: { row: RequestRow; onClose: () => void }) {
  const toast = useToast();
  const [note, setNote] = useState("");
  const [busy, start] = useTransition();
  const save = () =>
    start(async () => {
      const r = await declineIntentionRequest(row.id, note);
      if (!r.ok) return toast.show({ text: r.forbidden ? "Tega ne morete spremeniti." : r.error, tone: "error" });
      toast.show({ text: "Prošnja je zavrnjena.", historyId: r.data.historyId });
      onClose();
    });
  return (
    <Panel
      eyebrow="Prošnje"
      title="Zavrni prošnjo"
      sub={`${row.text} · ${row.name}`}
      onClose={onClose}
      footer={
        <>
          <Button variant="danger" size="lg" disabled={busy} onClick={save}>
            Zavrni
          </Button>
          <Button variant="ghost" size="lg" onClick={onClose}>
            Prekliči
          </Button>
        </>
      }
    >
      <Field label="Opomba (neobvezno)" hint={`Samo za župnišče. Prosilcu odgovorite sami: ${row.contact}.`}>
        <textarea rows={3} value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} placeholder="npr. Ta dan je že zaseden." />
      </Field>
    </Panel>
  );
}
