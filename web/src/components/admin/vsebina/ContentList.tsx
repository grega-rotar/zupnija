"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { reorderContent } from "@/app/admin/(app)/vsebina/actions";
import type { ListRow } from "@/app/admin/(app)/vsebina/queries";
import { Icon } from "@/components/admin/Icon";
import { useToast } from "@/components/admin/Toast";
import { ButtonLink, PageHead } from "@/components/admin/ui";
import { TYPES, type ContentType } from "@/lib/content/fields";
import { filterRows } from "./doc";
import "./vsebina.css";

/**
 * One content type's list: search, rows with a published dot, and, for
 * orderable types, a drag handle (also arrow keys on the handle) that saves
 * the new order at once.
 */
export function ContentList({ type, rows: initial, lede }: { type: ContentType; rows: ListRow[]; lede: string }) {
  const def = TYPES[type];
  const toast = useToast();
  const [rows, setRows] = useState(initial);
  const [q, setQ] = useState("");
  const [drag, setDrag] = useState<number | null>(null);
  const [, start] = useTransition();
  const shown = filterRows(rows, q);
  const canMove = !!def.orderable && !q.trim() && rows.length > 1;

  function commit(next: ListRow[], before: ListRow[]) {
    setRows(next);
    start(async () => {
      const r = await reorderContent(type, next.map((x) => x.id));
      if (!r.ok) {
        setRows(before);
        toast.show({ text: r.error === "forbidden" ? "Vrstnega reda ne morete spreminjati." : r.error, tone: "error" });
      } else if (r.data.status === "pending") toast.show("Vrstni red je poslan župniku v potrditev.");
      else toast.show({ text: "Vrstni red je shranjen.", historyId: r.data.historyId });
    });
  }

  const moveTo = (from: number, to: number) => {
    if (to < 0 || to >= rows.length || from === to) return;
    const next = [...rows];
    const [it] = next.splice(from, 1);
    next.splice(to, 0, it);
    commit(next, rows);
    requestAnimationFrame(() => document.getElementById(`grip-${it.id}`)?.focus());
  };

  return (
    <div className="page enter vs-page">
      <PageHead
        title={def.plural}
        sub={lede}
        action={
          <ButtonLink href={`/vsebina/${type}/nov`} variant="primary" icon="plus" prefetch={false}>
            {def.newLabel}
          </ButtonLink>
        }
      />

      {rows.length > 0 ? (
        <label className="vs-search">
          <Icon name="search" />
          <input type="search" placeholder="Iskanje" aria-label={`Iskanje: ${def.plural}`} value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
      ) : null}

      {rows.length === 0 ? (
        <div className="vs-empty surface">
          <span className="tile-ic">
            <Icon name="plus" />
          </span>
          <div>
            <b>Tu še ni ničesar.</b>
            <p>Ko dodate prvo, se pokaže na tem seznamu.</p>
          </div>
          <ButtonLink href={`/vsebina/${type}/nov`} variant="primary" icon="plus" prefetch={false}>
            {def.newLabel}
          </ButtonLink>
        </div>
      ) : shown.length === 0 ? (
        <p className="vs-none">Ni zadetkov za »{q.trim()}«.</p>
      ) : (
        <>
          {canMove ? <p className="vs-gh">Povlecite za vrstni red</p> : null}
          <ol className="vs-grp vs-list">
            {shown.map((r, i) => (
              <li
                key={r.id}
                className={drag === i ? "dragging" : undefined}
                onDragOver={canMove ? (e) => e.preventDefault() : undefined}
                onDrop={
                  canMove
                    ? (e) => {
                        e.preventDefault();
                        if (drag != null) moveTo(drag, i);
                        setDrag(null);
                      }
                    : undefined
                }
              >
                {canMove ? (
                  <button
                    type="button"
                    id={`grip-${r.id}`}
                    className="vs-grip"
                    draggable
                    onDragStart={(e) => {
                      setDrag(i);
                      e.dataTransfer.effectAllowed = "move";
                      e.dataTransfer.setData("text/plain", r.id);
                    }}
                    onDragEnd={() => setDrag(null)}
                    onKeyDown={(e) => {
                      if (e.key === "ArrowUp" || e.key === "ArrowDown") {
                        e.preventDefault();
                        moveTo(i, i + (e.key === "ArrowUp" ? -1 : 1));
                      }
                    }}
                    aria-label={`Premakni: ${r.title} (puščici gor in dol)`}
                  >
                    <Icon name="grip" />
                  </button>
                ) : null}
                <Link href={`/vsebina/${type}/${r.id}`} className="vs-row" prefetch={false}>
                  <span className="vs-row-t">
                    <b>{r.title}</b>
                    {r.subtitle ? <small>{r.subtitle}</small> : null}
                  </span>
                  {r.published ? (
                    <span className="vs-dot" title="Objavljeno">
                      <span className="sr">Objavljeno</span>
                    </span>
                  ) : (
                    <span className="vs-hidden">Skrito</span>
                  )}
                  <Icon name="r" className="chev" />
                </Link>
              </li>
            ))}
          </ol>
        </>
      )}
    </div>
  );
}
