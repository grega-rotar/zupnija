"use client";

import { Fragment, useState } from "react";
import { Icon } from "@/components/admin/Icon";
import { Button, IconButton, Pill } from "@/components/admin/ui";
import type { BulletinItem } from "@/lib/bulletin/types";
import { addDaysIso, checkFirst, fDayS, fSpan, fT, KINDS, NAM, OBV, optionLabel, parseTime, pl, pre, resolved, toCheck } from "./format";

export type Church = { slug: string; name: string };
type Busy = null | "publish" | "save" | "discard";

/** One flagged item's question: the options as chips, or "Popravi sam" with an input. */
function Question({ item, n, churches, churchName, week, onPick }: {
  item: BulletinItem;
  n: number;
  churches: Church[];
  churchName: (s: string) => string;
  week: string;
  onPick: (v: string) => void;
}) {
  const f = item.flag!;
  const [fixing, setFixing] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const id = `fix-${item.id}`;
  const open = () => {
    setErr(null);
    setFixing(f.field === "text" ? item.text : f.field === "time" ? fT(f.options[0] ?? item.time) : f.field === "date" ? (f.options[0] ?? item.date) : (f.options[0] ?? item.churchSlug));
  };
  const apply = () => {
    const v = (fixing ?? "").trim();
    if (!v) return setErr("Vpišite popravek.");
    if (f.field === "time") {
      const t = parseTime(v);
      if (!t) return setErr("Vpišite uro, npr. 18.30.");
      return onPick(t);
    }
    if (f.field === "text" && v.length > 200) return setErr("Največ 200 znakov.");
    onPick(v);
  };
  return (
    <div className="qbox">
      <p>
        <span className="qn">{n}</span>
        {f.question}
      </p>
      {fixing != null ? (
        <>
          <div className="fixrow">
            <label className="sr" htmlFor={id}>
              Popravek
            </label>
            {f.field === "church" ? (
              <select className="input" id={id} value={fixing} onChange={(e) => setFixing(e.target.value)} autoFocus>
                {churches.map((c) => (
                  <option key={c.slug} value={c.slug}>
                    {c.name}
                  </option>
                ))}
              </select>
            ) : (
              <input
                className="input"
                id={id}
                type={f.field === "date" ? "date" : "text"}
                inputMode={f.field === "time" ? "decimal" : undefined}
                min={f.field === "date" ? week : undefined}
                max={f.field === "date" ? addDaysIso(week, 6) : undefined}
                value={fixing}
                autoFocus
                aria-invalid={err ? true : undefined}
                aria-describedby={err ? `${id}-err` : undefined}
                onChange={(e) => {
                  setFixing(e.target.value);
                  setErr(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    apply();
                  }
                  if (e.key === "Escape") setFixing(null);
                }}
              />
            )}
            <Button variant="primary" onClick={apply}>
              Uporabi
            </Button>
          </div>
          {err ? (
            <small className="fixerr" id={`${id}-err`} role="alert">
              {err}
            </small>
          ) : null}
        </>
      ) : (
        <div className="chips">
          {f.options.map((o) => (
            <button key={o} type="button" className="chip" onClick={() => onPick(o)}>
              {optionLabel(item, f, o, churchName)}
            </button>
          ))}
          <button type="button" className="chip" onClick={open}>
            <Icon name="pen" />
            Popravi sam
          </button>
        </div>
      )}
    </div>
  );
}

/** "Vpiši ročno": the form that adds one intention row. */
function AddRow({ week, churches, onAdd }: { week: string; churches: Church[]; onAdd: (it: Omit<BulletinItem, "id">) => void }) {
  const days = Array.from({ length: 7 }, (_, i) => addDaysIso(week, i));
  const [date, setDate] = useState(days[6]);
  const [time, setTime] = useState("");
  const [church, setChurch] = useState(churches[0]?.slug ?? "");
  const [kind, setKind] = useState<BulletinItem["kind"]>("deceased");
  const [text, setText] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const add = () => {
    const t = parseTime(time);
    if (!t) return setErr("Vpišite uro, npr. 18.30.");
    if (!text.trim()) return setErr("Vpišite, za koga se daruje.");
    onAdd({ date, time: t, churchSlug: church, kind, text: text.trim().slice(0, 200) });
    setText("");
    setErr(null);
    document.getElementById("add-text")?.focus();
  };
  return (
    <div className="addrow">
      <div className="r3">
        <label className="field">
          <span>Dan</span>
          <select value={date} onChange={(e) => setDate(e.target.value)}>
            {days.map((d) => (
              <option key={d} value={d}>
                {fDayS(d)}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Ura</span>
          <input value={time} inputMode="decimal" placeholder="18.30" onChange={(e) => (setTime(e.target.value), setErr(null))} />
        </label>
        <label className="field">
          <span>Cerkev</span>
          <select value={church} onChange={(e) => setChurch(e.target.value)}>
            {churches.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="field">
        <span>Namen</span>
        <input
          id="add-text"
          value={text}
          placeholder="npr. Jože Novak"
          autoComplete="off"
          onChange={(e) => (setText(e.target.value), setErr(null))}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
        />
      </label>
      <div className="chips" role="group" aria-label="Vrsta namena">
        {KINDS.map(([v, l]) => (
          <button key={v} type="button" className="chip" aria-pressed={kind === v} onClick={() => setKind(v)}>
            {l}
          </button>
        ))}
      </div>
      <div className="acts">
        <Button icon="plus" onClick={add}>
          Dodaj namen
        </Button>
        {err ? (
          <small className="fixerr" role="alert">
            {err}
          </small>
        ) : null}
      </div>
    </div>
  );
}

/** Rows added by hand on this screen ("h1", "h2", …); Claude's are "i1", "i2", …. */
const hand = (it: BulletinItem) => /^h\d+$/.test(it.id);

export function Review(p: {
  week: string;
  items: BulletinItem[];
  notices: string[];
  picks: Record<string, string>;
  churches: Church[];
  approval: boolean;
  busy: Busy;
  onItems: (items: BulletinItem[]) => void;
  onNotices: (notices: string[]) => void;
  onPick: (id: string, v: string) => void;
  onPublish: () => void;
  onSave: () => void;
  onDiscard: () => void;
}) {
  const [confirm, setConfirm] = useState(false);
  const [adding, setAdding] = useState(p.items.length === 0);
  const churchName = (s: string) => p.churches.find((c) => c.slug === s)?.name ?? s;
  const flagged = p.items.filter((i) => i.flag);
  const open = flagged.filter((i) => !p.picks[i.id]).length;
  const notices = p.notices.filter((n) => n.trim()).length;
  const empty = !p.items.length && !notices;
  let n = 0;

  const addNotice = () => {
    p.onNotices([...p.notices, ""]);
    requestAnimationFrame(() => document.getElementById(`news-${p.notices.length}`)?.focus());
  };

  return (
    <div className="draft">
      <div className="dsum">
        <Pill>{fSpan(p.week)}</Pill>
        <Pill tone="line">{pl(p.items.length, NAM)}</Pill>
        <Pill tone="line">{pl(notices, OBV)}</Pill>
        {open ? <Pill tone="gold">{toCheck(open)}</Pill> : p.items.length ? <Pill icon="check">vse preverjeno</Pill> : null}
      </div>

      <div className="drows">
        {p.items.map((raw) => {
          const f = raw.flag;
          const pick = p.picks[raw.id];
          const it = resolved(raw, pick);
          const num = f ? ++n : 0;
          return (
            <div key={raw.id} className={`drow ${f && !pick ? "flag" : ""} ${f && pick ? "fixed" : ""} ${hand(raw) ? "hand" : ""}`}>
              <span className="d">{fDayS(it.date)}</span>
              <time className="tnum">{fT(it.time)}</time>
              <span className="t">
                {pre(it.kind)} {it.text}
                <small>{churchName(it.churchSlug)}</small>
              </span>
              {hand(raw) ? <IconButton icon="x" label={`Odstrani namen ${it.text}`} className="rm" onClick={() => p.onItems(p.items.filter((x) => x.id !== raw.id))} /> : null}
              {f && !pick ? <Question item={raw} n={num} churches={p.churches} churchName={churchName} week={p.week} onPick={(v) => p.onPick(raw.id, v)} /> : null}
            </div>
          );
        })}
        {!p.items.length ? <p className="empty-draft">Vpišite namene tega tedna. Vsak namen dodajte posebej.</p> : null}
      </div>

      {adding ? (
        <AddRow
          week={p.week}
          churches={p.churches}
          onAdd={(it) => {
            const next = Math.max(0, ...p.items.filter(hand).map((x) => Number(x.id.slice(1)) || 0)) + 1;
            const items = [...p.items, { ...it, id: `h${next}` }].sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
            p.onItems(items);
          }}
        />
      ) : (
        <button type="button" className="addline" onClick={() => setAdding(true)}>
          <Icon name="plus" />
          Dodaj namen
        </button>
      )}

      <div className="blk">
        <h3>Obvestila</h3>
        <div className="news">
          {p.notices.map((t, i) => (
            <Fragment key={i}>
              <label className="sr" htmlFor={`news-${i}`}>
                Obvestilo {i + 1}
              </label>
              <textarea id={`news-${i}`} rows={2} value={t} onChange={(e) => p.onNotices(p.notices.map((x, j) => (j === i ? e.target.value : x)))} />
            </Fragment>
          ))}
          <button type="button" className="addline" onClick={addNotice}>
            <Icon name="plus" />
            Dodaj obvestilo
          </button>
        </div>
      </div>

      <div className="actionbar">
        {confirm ? (
          <div className="banner alert" role="alertdialog" aria-labelledby="discard-q">
            <b id="discard-q">Zavržem ta osnutek?</b>
            <p>Nič ni bilo objavljeno. Oznanila za ta teden boste lahko naložili znova.</p>
            <div className="acts">
              <Button variant="danger" onClick={p.onDiscard} disabled={p.busy != null} autoFocus>
                {p.busy === "discard" ? "Zavržem …" : "Zavrzi osnutek"}
              </Button>
              <Button variant="ghost" onClick={() => setConfirm(false)} disabled={p.busy != null}>
                Nazaj
              </Button>
            </div>
          </div>
        ) : (
          <>
            <Button
              variant="primary"
              size="lg"
              icon={open || empty ? undefined : p.approval ? "send" : "check"}
              disabled={!!open || empty || p.busy != null}
              onClick={p.onPublish}
            >
              {open
                ? checkFirst(open)
                : empty
                  ? "Dodajte vsaj en namen"
                  : p.busy === "publish"
                    ? p.approval
                      ? "Pošiljam …"
                      : "Objavljam …"
                    : p.approval
                      ? "Pošlji župniku"
                      : "Objavi oznanila"}
            </Button>
            <Button variant="ghost" onClick={p.onSave} disabled={p.busy != null}>
              {p.busy === "save" ? "Shranjujem …" : "Shrani za pozneje"}
            </Button>
            <Button variant="ghost-danger" onClick={() => setConfirm(true)} disabled={p.busy != null}>
              Zavrzi
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
