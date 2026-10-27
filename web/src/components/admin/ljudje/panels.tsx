"use client";

import { useRef, useState, useTransition } from "react";
import { invite, removePerson, savePerson } from "@/app/admin/(app)/ljudje/actions";
import { Panel } from "@/components/admin/Panel";
import { useToast } from "@/components/admin/Toast";
import { Button, Chip, Field, Switch } from "@/components/admin/ui";
import type { ActionResult } from "@/lib/admin/errors";
import { SECTION_LABEL, SECTIONS, type Section } from "@/lib/admin/sections";
import type { PersonView } from "./PeopleScreen";

const PRESETS: Record<string, Section[]> = {
  Tajnica: ["mase", "oznanila", "dogodki"],
  Katehist: ["verouk"],
  Zborovodja: ["dogodki"],
  Karitas: ["dogodki"],
};

type Access = { sections: Section[]; approval: boolean };

/** "Kaj sme urejati" and "Objava": the same switches on both panels. */
function SectionSwitches({ value, onChange }: { value: Access; onChange: (v: Access) => void }) {
  const toggle = (s: Section, on: boolean) => {
    const set = new Set(value.sections);
    if (on) set.add(s);
    else set.delete(s);
    onChange({ ...value, sections: SECTIONS.filter((x) => set.has(x)) });
  };
  return (
    <>
      <div className="blk">
        <h3>Kaj sme urejati</h3>
        <div>
          {SECTIONS.map((s) => (
            <Switch key={s} label={SECTION_LABEL[s]} checked={value.sections.includes(s)} onChange={(on) => toggle(s, on)} />
          ))}
        </div>
      </div>
      <div className="blk">
        <h3>Objava</h3>
        <Switch
          label="Spremembe potrdim jaz"
          hint="Na strani so šele, ko jih potrdite. Priporočeno za nove sodelavce."
          checked={value.approval}
          onChange={(approval) => onChange({ ...value, approval })}
        />
      </div>
    </>
  );
}

/** Run a server action; an unexpected failure becomes an ActionResult too. */
async function attempt<T>(fn: () => Promise<ActionResult<T>>): Promise<ActionResult<T>> {
  try {
    return await fn();
  } catch {
    return { ok: false, error: "Ni šlo. Preverite povezavo in poskusite znova." };
  }
}
const errorText = (r: { error: string; forbidden?: boolean }) => (r.forbidden ? "Tega ne morete spremeniti." : r.error);

export function PersonPanel({ person, onClose }: { person: PersonView; onClose: () => void }) {
  const toast = useToast();
  const [access, setAccess] = useState<Access>({ sections: person.sections, approval: person.requiresApproval });
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();
  const confirmRef = useRef<HTMLDivElement>(null);
  const changed = access.approval !== person.requiresApproval || access.sections.join() !== person.sections.join();

  function save() {
    if (!changed) {
      onClose();
      return toast.show("Shranjeno. Spremembe veljajo ob naslednjem kliku.");
    }
    startTransition(async () => {
      const r = await attempt(() => savePerson({ userId: person.id, sections: access.sections, requiresApproval: access.approval }));
      if (!r.ok) return toast.show({ text: errorText(r), tone: "error" });
      onClose();
      toast.show({ text: "Shranjeno. Spremembe veljajo ob naslednjem kliku.", historyId: r.data.historyId });
    });
  }

  function revoke() {
    startTransition(async () => {
      const r = await attempt(() => removePerson(person.id));
      if (!r.ok) return toast.show({ text: errorText(r), tone: "error" });
      onClose();
      toast.show({ text: `${person.name} nima več dostopa.`, historyId: r.data.historyId });
    });
  }

  function askRevoke() {
    setConfirming(true);
    requestAnimationFrame(() => {
      confirmRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
      confirmRef.current?.querySelector<HTMLButtonElement>("button")?.focus({ preventScroll: true });
    });
  }

  return (
    <Panel
      eyebrow={person.title}
      title={person.name}
      sub={`${person.email}${person.invited ? " · povabilo poslano" : ""}`}
      onClose={onClose}
      footer={
        confirming ? null : (
          <>
            <Button variant="primary" size="lg" onClick={save} disabled={pending}>
              Shrani
            </Button>
            <Button variant="danger" size="lg" onClick={askRevoke} disabled={pending}>
              Odvzemi dostop
            </Button>
          </>
        )
      }
    >
      <SectionSwitches value={access} onChange={setAccess} />
      {confirming ? (
        <div className="banner alert" ref={confirmRef} role="alertdialog" aria-label="Res odvzamem dostop?">
          <b>Res odvzamem dostop?</b>
          <p>{person.name} se odjavi takoj in ne more več urejati. Dostop lahko vrnete v Zgodovini z »Razveljavi«.</p>
          <div className="acts">
            <Button variant="danger" style={{ background: "var(--paper)" }} onClick={revoke} disabled={pending}>
              Potrdi
            </Button>
            <Button variant="ghost" onClick={() => setConfirming(false)} disabled={pending}>
              Prekliči
            </Button>
          </div>
        </div>
      ) : null}
    </Panel>
  );
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function InvitePanel({ onClose }: { onClose: () => void }) {
  const toast = useToast();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [title, setTitle] = useState("Tajnica");
  const [access, setAccess] = useState<Access>({ sections: PRESETS.Tajnica, approval: true });
  const [pending, startTransition] = useTransition();
  const valid = name.trim().length > 0 && EMAIL.test(email.trim()) && access.sections.length > 0;

  function send() {
    if (!valid) return;
    const to = email.trim();
    startTransition(async () => {
      const r = await attempt(() => invite({ name: name.trim(), email: to, title, sections: access.sections, requiresApproval: access.approval }));
      if (!r.ok) return toast.show({ text: errorText(r), tone: "error" });
      onClose();
      toast.show(
        r.data.mailed
          ? { text: `Povabilo je poslano na ${to}.`, historyId: r.data.historyId }
          : { text: `Oseba je dodana, e-pošte na ${to} pa ni bilo mogoče poslati.`, tone: "error", historyId: r.data.historyId },
      );
    });
  }

  return (
    <Panel
      eyebrow="Ljudje in dostop"
      title="Povabi osebo"
      sub="Dobila bo e-pošto s povezavo za prijavo. Gesla ne potrebuje."
      onClose={onClose}
      footer={
        <>
          <Button variant="primary" size="lg" icon="mail" onClick={send} disabled={!valid || pending}>
            Pošlji povabilo
          </Button>
          <Button variant="ghost" size="lg" onClick={onClose}>
            Prekliči
          </Button>
        </>
      }
    >
      <form
        id="invite-form"
        style={{ display: "contents" }}
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
      >
        <Field label="Ime in priimek">
          <input id="f-name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" maxLength={120} />
        </Field>
        <Field label="E-pošta">
          <input id="f-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="off" inputMode="email" />
        </Field>
        <Field label="Vloga" as="div">
          <div className="chips" role="group" aria-label="Vloga">
            {Object.keys(PRESETS).map((k) => (
              <Chip
                key={k}
                pressed={title === k}
                onClick={() => {
                  setTitle(k);
                  setAccess((a) => ({ ...a, sections: PRESETS[k] }));
                }}
              >
                {k}
              </Chip>
            ))}
          </div>
        </Field>
        <SectionSwitches value={access} onChange={setAccess} />
        <button type="submit" hidden />
      </form>
    </Panel>
  );
}
