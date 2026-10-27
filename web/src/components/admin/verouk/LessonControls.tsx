"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { cancelLessonFromPanel, restoreLessonFromCard } from "@/app/admin/(app)/verouk/actions";
import { Panel } from "@/components/admin/Panel";
import { useToast } from "@/components/admin/Toast";
import { Button } from "@/components/admin/ui";
import s from "./verouk.module.css";

const errText = (e: string) => (e === "forbidden" ? "Verouka ne morete urejati." : e);

/** "Vrni uro" on a cancelled lesson card. */
export function RestoreButton({ groupId, date }: { groupId: number; date: string }) {
  const toast = useToast();
  const [busy, start] = useTransition();
  return (
    <Button
      icon="undo"
      disabled={busy}
      aria-busy={busy}
      onClick={() =>
        start(async () => {
          const r = await restoreLessonFromCard({ groupId, date });
          if (!r.ok) return toast.show({ text: errText(r.error), tone: "error" });
          toast.show(r.data.status === "pending" ? { text: "Poslano župniku v potrditev." } : { text: "Ura verouka je spet na urniku.", historyId: r.data.historyId });
        })
      }
    >
      Vrni uro
    </Button>
  );
}

/** The prototype's pGroup(): cancel this week's lesson with a message for parents. */
export function CancelPanel({ groupId, date, name, when }: { groupId: number; date: string; name: string; when: string }) {
  const router = useRouter();
  const toast = useToast();
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, start] = useTransition();
  const close = () => router.replace("/verouk", { scroll: false });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    start(async () => {
      const r = await cancelLessonFromPanel({ groupId, date, message: msg });
      if (!r.ok) return setErr(errText(r.error));
      toast.show(
        r.data.status === "pending"
          ? { text: "Poslano župniku v potrditev." }
          : { text: "Shranjeno. Starši bodo obvestilo videli na strani Verouk.", historyId: r.data.historyId },
      );
      close();
    });
  }

  return (
    <Panel
      eyebrow="Verouk"
      title={`${name} odpade`}
      sub={when}
      onClose={close}
      footer={
        <>
          <Button variant="primary" size="lg" type="submit" form="lesson-cancel" disabled={busy} aria-busy={busy}>
            Potrdi odpoved
          </Button>
          <Button variant="ghost" size="lg" onClick={close}>
            Prekliči
          </Button>
        </>
      }
    >
      <form id="lesson-cancel" className={s.form} onSubmit={submit} noValidate>
        <label className="field">
          <span>Sporočilo staršem</span>
          <textarea
            id="f-msg"
            value={msg}
            onChange={(e) => {
              setMsg(e.target.value);
              setErr(null);
            }}
            placeholder="npr. Zaradi jesenskih počitnic se vidimo naslednji teden."
            aria-invalid={err ? true : undefined}
            aria-describedby={err ? "f-msg-err" : undefined}
          />
          {err ? (
            <small className={s.err} id="f-msg-err" role="alert">
              {err}
            </small>
          ) : (
            <small>Starši ga vidijo na strani Verouk pri tej skupini.</small>
          )}
        </label>
      </form>
    </Panel>
  );
}
