"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { saveReadingHintsAction } from "@/app/admin/(app)/oznanila/actions";
import { Panel } from "@/components/admin/Panel";
import { useToast } from "@/components/admin/Toast";
import { Button, Field } from "@/components/admin/ui";
import "./oznanila.css";

const MAX = 4000;

/**
 * "Navodila za branje oznanil" (owner only): what Claude should know about
 * the parish's bulletin. When the format changes, the priest describes the
 * new layout here instead of waiting for a code change.
 */
export function ReadingHints({ initial }: { initial: string }) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [saved, setSaved] = useState(initial);
  const [text, setText] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const close = () => {
    setOpen(false);
    setText(saved);
    setErr(null);
  };
  const save = async () => {
    if (text.length > MAX) return setErr(`Največ ${MAX} znakov.`);
    setBusy(true);
    const r = await saveReadingHintsAction(text).catch(() => null);
    setBusy(false);
    if (!r) return setErr("Shranjevanje ni uspelo. Preverite povezavo.");
    if (!r.ok) return setErr(r.error);
    setSaved(text.trim());
    setOpen(false);
    toast.show({ text: "Navodila za branje so shranjena. Claude jih upošteva od naslednjih oznanil.", historyId: r.data.historyId });
    router.refresh();
  };

  return (
    <>
      <Button variant="ghost" icon="text" onClick={() => setOpen(true)}>
        Navodila za branje
      </Button>
      {open ? (
        <Panel
          eyebrow="Oznanila"
          title="Navodila za branje oznanil"
          sub="Claude upošteva ta navodila, ko bere oznanila. Če se oblika oznanil spremeni, jih popravite tukaj."
          onClose={close}
          autoFocus="textarea"
          footer={
            <>
              <Button variant="primary" size="lg" icon="check" onClick={save} disabled={busy || text.trim() === saved.trim()}>
                {busy ? "Shranjujem …" : "Shrani navodila"}
              </Button>
              <Button variant="ghost" size="lg" onClick={close} disabled={busy}>
                Prekliči
              </Button>
            </>
          }
        >
          <Field label="Navodila" hint={`Pišite, kot bi razložili novemu sodelavcu: kje je kaj napisano, kaj pomenijo okrajšave. ${text.length}/${MAX}`}>
            <textarea
              className="hints"
              value={text}
              rows={14}
              aria-invalid={err ? true : undefined}
              onChange={(e) => {
                setText(e.target.value);
                setErr(null);
              }}
            />
          </Field>
          {err ? (
            <p className="pickerr" role="alert">
              {err}
            </p>
          ) : null}
        </Panel>
      ) : null}
    </>
  );
}
