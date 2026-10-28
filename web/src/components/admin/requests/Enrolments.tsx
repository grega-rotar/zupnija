"use client";

import { useState, useTransition } from "react";
import { Icon } from "@/components/admin/Icon";
import { useToast } from "@/components/admin/Toast";
import { btnClass, Switch } from "@/components/admin/ui";
import { setEnrolmentOpen } from "./actions";
import s from "./requests.module.css";

export type EnrolmentRow = {
  id: number;
  number: string;
  child: string;
  grade: number;
  group: string | null;
  parents: { who: "Oče" | "Mati"; name: string; contact: string }[];
  activities: string[];
  photoArchive: boolean;
  photoPublish: boolean;
  /** "27. 10. 2026" */
  at: string;
};

function Consent({ on, label }: { on: boolean; label: string }) {
  return (
    <span className={`${s.consent} ${on ? s.yes : s.no}`} title={`${label}: ${on ? "da" : "ne"}`}>
      <Icon name={on ? "check" : "x"} />
      {label}
      <span className="sr-only">: {on ? "da" : "ne"}</span>
    </span>
  );
}

/** Verouk → Vpisi (US-006): the online enrolments, the CSV export and the open/closed switch. */
export function Enrolments({ rows, open, year }: { rows: EnrolmentRow[]; open: boolean; year: string }) {
  const toast = useToast();
  const [on, setOn] = useState(open);
  const [busy, start] = useTransition();
  const toggle = (next: boolean) =>
    start(async () => {
      setOn(next);
      const r = await setEnrolmentOpen(next);
      if (!r.ok) {
        setOn(!next);
        return toast.show({ text: r.forbidden ? "Tega ne morete spremeniti." : r.error, tone: "error" });
      }
      toast.show({ text: next ? "Spletni vpis je odprt." : "Spletni vpis je zaprt.", historyId: r.data.historyId });
    });

  return (
    <>
      <div className={s.bar}>
        <div className="grp">
          <Switch label="Spletni vpis je odprt" hint={on ? `Starši vpisujejo na strani /verouk/vpis za ${year}.` : `Na strani piše: Vpisi za šolsko leto ${year} so zaprti.`} checked={on} disabled={busy} onChange={toggle} />
        </div>
        {rows.length ? (
          <a className={btnClass()} href="/verouk/vpisi/csv" download>
            <Icon name="down" />
            Izvozi CSV
          </a>
        ) : null}
      </div>

      {rows.length ? (
        <ul className={s.list}>
          {rows.map((r) => (
            <li key={r.id} className={s.req}>
              <div>
                <h3>{r.child}</h3>
                <p className={s.meta}>
                  {r.grade}. razred{r.group ? ` · ${r.group}` : ""} · <span className={s.num}>{r.number}</span> · {r.at}
                </p>
                <div className={s.facts}>
                  {r.parents.map((p) => (
                    <span key={p.who}>
                      {p.who}: {p.name}
                      {p.contact ? `, ${p.contact}` : ""}
                    </span>
                  ))}
                </div>
                <div className={s.facts}>
                  <Consent on={r.photoArchive} label="Arhiv fotografij" />
                  <Consent on={r.photoPublish} label="Objava fotografij" />
                  {r.activities.length ? <span>{r.activities.join(", ")}</span> : null}
                </div>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <div className="calm">
          <h3>Še ni spletnih vpisov.</h3>
          <p>Ko starši oddajo vpis na strani, bo tukaj, z vsemi podatki in soglasji.</p>
        </div>
      )}
    </>
  );
}
