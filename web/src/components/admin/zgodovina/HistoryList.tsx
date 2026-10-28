"use client";

import { useState, useTransition } from "react";
import { undoHistory } from "@/app/admin/actions";
import { useToast } from "@/components/admin/Toast";
import { Button, Pill } from "@/components/admin/ui";
import type { HistoryDay } from "@/lib/zgodovina/queries";

/** The `.hist` list: day headings, then one `.hrow` per change. */
export function HistoryList({ days }: { days: HistoryDay[] }) {
  const toast = useToast();
  const [busy, setBusy] = useState<number | null>(null);
  const [, startTransition] = useTransition();

  function undo(id: number) {
    setBusy(id);
    startTransition(async () => {
      try {
        const r = await undoHistory(id);
        toast.show(r.ok ? { text: r.data.label } : { text: r.forbidden ? "Tega ne morete razveljaviti." : r.error, tone: "error" });
      } catch {
        toast.show({ text: "Razveljavitev ni uspela. Poskusite znova.", tone: "error" });
      } finally {
        setBusy(null);
      }
    });
  }

  if (!days.length) {
    return (
      <div className="calm">
        <h3>Še ni sprememb.</h3>
        <p>Ko kdo kaj spremeni, bo zapisano tukaj.</p>
      </div>
    );
  }

  return (
    <div className="hist">
      {days.map((d) => (
        <section key={d.key} aria-label={d.label} style={{ display: "contents" }}>
          <p className="hday">{d.label}</p>
          <div className="grp">
            {d.entries.map((h) => (
              <div key={h.id} className="hrow">
                <time className="tnum">{h.at}</time>
                <span className={`avatar${h.who?.isOwner ? " moss" : ""}`} aria-hidden="true">
                  {h.who?.short ?? "?"}
                </span>
                <div>
                  <b>{h.label}</b>
                  <p>
                    {h.who?.name ?? "Nekdanji sodelavec"}
                    {h.note ? ` · ${h.note}` : ""}
                  </p>
                </div>
                {h.undone ? (
                  <Pill tone="line">razveljavljeno</Pill>
                ) : h.canUndo ? (
                  <Button size="sm" icon="undo" onClick={() => undo(h.id)} disabled={busy != null} aria-label={`Razveljavi: ${h.label}`}>
                    Razveljavi
                  </Button>
                ) : (
                  <span />
                )}
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
