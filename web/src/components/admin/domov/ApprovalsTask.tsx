"use client";

import { useState, useTransition } from "react";
import { Icon } from "@/components/admin/Icon";
import { useToast } from "@/components/admin/Toast";
import { Button } from "@/components/admin/ui";
import { firstName, pl, SPREMEMBA_CAKA } from "@/lib/domov/format";
import type { ApprovalRow } from "@/lib/domov/loader";
import { approveAll, approveChange, rejectChange } from "./actions";

/** The owner's "N sprememb čaka vašo potrditev" card (prototype: approvals / decide / decideAll). */
export function ApprovalsTask({ rows }: { rows: ApprovalRow[] }) {
  const toast = useToast();
  const [gone, setGone] = useState<number[]>([]);
  const [busy, startTransition] = useTransition();
  const list = rows.filter((r) => !gone.includes(r.id));
  if (!list.length) return null;

  const fail = (r: { error: string; forbidden?: boolean }) =>
    toast.show({ text: r.forbidden ? "Spremembe potrjuje samo župnik." : r.error, tone: "error" });
  const run = (fn: () => Promise<void>) =>
    startTransition(async () => {
      try {
        await fn();
      } catch {
        toast.show({ text: "Ni uspelo. Poskusite znova.", tone: "error" });
      }
    });

  const decide = (row: ApprovalRow, yes: boolean) =>
    run(async () => {
      if (yes) {
        const r = await approveChange(row.id);
        if (!r.ok) return fail(r);
        setGone((g) => [...g, row.id]);
        toast.show({ text: "Potrjeno in objavljeno.", historyId: r.data.historyId });
      } else {
        const r = await rejectChange(row.id);
        if (!r.ok) return fail(r);
        setGone((g) => [...g, row.id]);
        toast.show(`Zavrnjeno. ${firstName(row.byName)} bo to videla na svojem začetnem zaslonu.`);
      }
    });

  const decideAll = () =>
    run(async () => {
      const ids = list.map((r) => r.id);
      const r = await approveAll(ids);
      if (!r.ok) return fail(r);
      setGone((g) => [...g, ...ids]);
      // One undo button can take back one change; offer it only when that is everything.
      const h = r.data.historyIds;
      toast.show({ text: "Vse je potrjeno in objavljeno.", historyId: h.length === 1 ? h[0] : null });
    });

  return (
    <li className="task approve">
      <span className="ic">
        <Icon name="inbox" />
      </span>
      <h3>{pl(list.length, SPREMEMBA_CAKA)} vašo potrditev</h3>
      <p>Pomočniki so jih vpisali, na strani bodo, ko jih potrdite.</p>
      <ul className="appr-list">
        {list.map((a) => (
          <li key={a.id} className="appr">
            <div>
              <b>{a.what}</b>
              <small>
                {a.where ? `${a.where} · ` : ""}
                {a.byName}, {a.at}
              </small>
              {a.note ? <span className="note">»{a.note}«</span> : null}
            </div>
            <div className="acts">
              <Button size="sm" variant="primary" icon="check" disabled={busy} onClick={() => decide(a, true)}>
                Potrdi
              </Button>
              <Button size="sm" variant="ghost" disabled={busy} onClick={() => decide(a, false)}>
                Zavrni
              </Button>
            </div>
          </li>
        ))}
      </ul>
      {list.length > 1 ? (
        <div className="acts">
          <Button variant="primary" disabled={busy} onClick={decideAll}>
            Potrdi vse ({list.length})
          </Button>
        </div>
      ) : null}
    </li>
  );
}
