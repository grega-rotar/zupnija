"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { deleteEventFromPanel, saveEventFromPanel, type EventField } from "@/app/admin/(app)/dogodki/actions";
import { Panel } from "@/components/admin/Panel";
import { useToast } from "@/components/admin/Toast";
import { Button, Switch } from "@/components/admin/ui";
import { PLACES } from "@/lib/dogodki/places";
import s from "./dogodki.module.css";

export type EventDraft = {
  id: number | null;
  title: string;
  date: string;
  time: string;
  place: string;
  description: string;
  onFrontPage: boolean;
};

export type EventPanelProps = {
  draft: EventDraft;
  /** A helper's change waiting for the owner (the draft then shows the proposal). */
  pending: { changeRequestId: number; byName: string } | null;
  isOwner: boolean;
  /** The viewer's own changes wait for the owner. */
  approval: boolean;
};

const FORM_ID = "event-form";

/** The prototype's pEvent(): add or edit one event, in the side panel / bottom sheet. */
export function EventPanel({ draft, pending, isOwner, approval }: EventPanelProps) {
  const router = useRouter();
  const toast = useToast();
  const [f, setF] = useState(draft);
  const [err, setErr] = useState<{ field: EventField | null; text: string } | null>(null);
  const [busy, start] = useTransition();
  const form = useRef<HTMLFormElement>(null);
  const isNew = draft.id == null && !pending;
  // A helper can't change a proposal that already waits for the owner; the owner settles it by saving.
  const locked = !!pending && !isOwner;

  const close = () => router.replace("/dogodki", { scroll: false });
  const set = <K extends keyof EventDraft>(k: K, v: EventDraft[K]) => {
    setF((x) => ({ ...x, [k]: v }));
    if (err?.field === k || (err?.field === "time" && k === "date") || (err?.field === "date" && k === "time")) setErr(null);
  };

  function save(e: React.FormEvent) {
    e.preventDefault();
    if (locked || busy) return;
    start(async () => {
      const r = await saveEventFromPanel({ ...f, id: f.id ?? undefined, proposal: pending?.changeRequestId });
      if (!r.ok) {
        const field = "field" in r ? r.field : null;
        setErr({ field, text: r.error === "forbidden" ? "Dogodkov ne morete urejati." : r.error });
        if (field) form.current?.querySelector<HTMLElement>(`#f-${field}`)?.focus();
        return;
      }
      toast.show(
        r.data.status === "pending"
          ? { text: "Poslano župniku v potrditev." }
          : { text: "Shranjeno. Dogodek je na strani.", historyId: r.data.historyId },
      );
      close();
    });
  }

  function remove() {
    if (busy) return;
    start(async () => {
      const r = await deleteEventFromPanel({ id: draft.id, proposal: pending?.changeRequestId });
      if (!r.ok) {
        setErr({ field: null, text: r.error === "forbidden" ? "Dogodka ne morete izbrisati." : r.error });
        return;
      }
      toast.show(r.data.historyId != null ? { text: "Dogodek je izbrisan.", historyId: r.data.historyId } : { text: "Predlog je zavrnjen." });
      close();
    });
  }

  const fieldErr = (k: EventField) => (err?.field === k ? err.text : null);
  const msg = (k: EventField) =>
    fieldErr(k) ? (
      <small className={s.err} id={`f-${k}-err`} role="alert">
        {fieldErr(k)}
      </small>
    ) : null;
  const inv = (k: EventField) => (fieldErr(k) ? { "aria-invalid": true as const, "aria-describedby": `f-${k}-err` } : {});
  const whenErr = fieldErr("date") ?? fieldErr("time");

  const footer = locked ? (
    <Button size="lg" block onClick={close}>
      Zapri
    </Button>
  ) : (
    <>
      <Button variant="primary" size="lg" type="submit" form={FORM_ID} disabled={busy} aria-busy={busy}>
        {approval ? "Pošlji v potrditev" : isNew ? "Dodaj dogodek" : "Shrani"}
      </Button>
      {!isNew && isOwner ? (
        <Button variant="danger" size="lg" icon="trash" onClick={remove} disabled={busy}>
          Izbriši
        </Button>
      ) : (
        <Button variant="ghost" size="lg" onClick={close}>
          Prekliči
        </Button>
      )}
    </>
  );

  return (
    <Panel
      eyebrow="Dogodki"
      title={isNew ? "Nov dogodek" : "Uredi dogodek"}
      sub={pending ? `Čaka potrditev · ${pending.byName}` : "Pokaže se na strani Dogodki in v koledarju."}
      onClose={close}
      footer={footer}
    >
      <form id={FORM_ID} ref={form} className={s.form} onSubmit={save} noValidate>
        <fieldset disabled={locked} style={{ display: "contents" }}>
          <label className="field">
            <span>Naslov</span>
            <input id="f-title" value={f.title} onChange={(e) => set("title", e.target.value)} placeholder="npr. Srečanje ključarjev" autoComplete="off" {...inv("title")} />
            {msg("title")}
          </label>
          <div className="row2">
            <label className="field">
              <span>Datum</span>
              <input id="f-date" type="date" value={f.date} onChange={(e) => set("date", e.target.value)} {...inv("date")} />
            </label>
            <label className="field">
              <span>Ura</span>
              <input id="f-time" type="time" value={f.time} onChange={(e) => set("time", e.target.value)} {...inv("time")} />
            </label>
          </div>
          {whenErr ? (
            <small className={`${s.err} ${s.whenErr}`} id={`f-${fieldErr("date") ? "date" : "time"}-err`} role="alert">
              {whenErr}
            </small>
          ) : null}
          <label className="field">
            <span>Kraj</span>
            <select id="f-place" value={f.place} onChange={(e) => set("place", e.target.value)} {...inv("place")}>
              {(PLACES as readonly string[]).includes(f.place) ? null : <option>{f.place}</option>}
              {PLACES.map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
            {msg("place")}
          </label>
          <label className="field">
            <span>Opis</span>
            <textarea id="f-description" value={f.description} onChange={(e) => set("description", e.target.value)} placeholder="Kaj naj ljudje vedo? Ni obvezno." {...inv("description")} />
            {msg("description")}
          </label>
          <Switch label="Pokaži na prvi strani" hint="Med novicami na začetni strani." id="f-front" checked={f.onFrontPage} onChange={(on) => set("onFrontPage", on)} disabled={locked} />
        </fieldset>
        {approval || locked ? (
          <div className="banner gold">
            <p>Dogodek bo na strani, ko ga potrdi župnik.</p>
          </div>
        ) : null}
        {err && !err.field ? (
          <div className="banner alert" role="alert">
            <p>{err.text}</p>
          </div>
        ) : null}
      </form>
    </Panel>
  );
}
