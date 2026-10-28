"use client";

import { useState, useTransition } from "react";
import { Icon } from "@/components/admin/Icon";
import { useToast } from "@/components/admin/Toast";
import { Button } from "@/components/admin/ui";
import { resolveSacramentRequest } from "./actions";

export type InboxRow = { id: number; title: string; contact: string; when: string; message: string };

const contactHref = (c: string) => (c.includes("@") ? `mailto:${c}` : `tel:${c.replace(/[^\d+]/g, "")}`);

/** Domov, "Na vrsti": sacrament enquiries from the site (US-008), each resolved with one tap. */
export function SacramentInbox({ rows }: { rows: InboxRow[] }) {
  const toast = useToast();
  const [gone, setGone] = useState<number[]>([]);
  const [busy, start] = useTransition();
  const list = rows.filter((r) => !gone.includes(r.id));
  if (!list.length) return null;

  const resolve = (row: InboxRow) =>
    start(async () => {
      const r = await resolveSacramentRequest(row.id);
      if (!r.ok) return toast.show({ text: r.forbidden ? "Tega ne morete spremeniti." : r.error, tone: "error" });
      setGone((g) => [...g, row.id]);
      toast.show({ text: "Označeno kot rešeno.", historyId: r.data.historyId });
    });

  return (
    <li className="task">
      <span className="ic">
        <Icon name="mail" />
      </span>
      <h3>{list.length === 1 ? "Novo povpraševanje s strani" : `Nova povpraševanja s strani: ${list.length}`}</h3>
      <p>Odgovorite po telefonu ali e-pošti, nato označite kot rešeno.</p>
      <ul className="appr-list">
        {list.map((a) => (
          <li key={a.id} className="appr">
            <div>
              <b>Novo povpraševanje: {a.title}</b>
              <small>
                <a href={contactHref(a.contact)} className="underline underline-offset-2">
                  {a.contact}
                </a>{" "}
                · {a.when}
              </small>
              <span className="note">»{a.message}«</span>
            </div>
            <div className="acts">
              <Button size="sm" icon="check" disabled={busy} onClick={() => resolve(a)}>
                Označi kot rešeno
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </li>
  );
}
