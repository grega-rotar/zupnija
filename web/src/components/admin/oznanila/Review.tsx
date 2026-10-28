"use client";

import { useState } from "react";
import { Icon } from "@/components/admin/Icon";
import { Button, Chip, ChipGroup, IconButton, Pill, Switch } from "@/components/admin/ui";
import { ChurchPill, DayLeaf } from "@/components/masses/MassList";
import { dateRange } from "@/lib/dates";
import { weeksOf, type BulletinFlag, type DraftDay, type DraftEvent, type DraftIntention, type ReadableDraft } from "@/lib/bulletin/types";
import { cn } from "@/lib/utils";
import {
  checkFirst,
  eventWhen,
  fSpan,
  fT,
  isUnplaced,
  KINDS,
  NAM,
  OBV,
  optionLabel,
  parseTime,
  pl,
  periodName,
  placed,
  pre,
  resolved,
  resolvedEvent,
  SRE,
  toCheck,
} from "./format";

export type Church = { slug: string; name: string };
/** A generated Mass of the period (the server's schedule), for choosing where an intention goes. */
export type SlotMass = { date: string; time: string; churchSlug: string };
export type Busy = null | "publish" | "save" | "discard";
type Kind = DraftIntention["kind"];

const isSunday = (iso: string) => new Date(`${iso}T12:00:00Z`).getUTCDay() === 0;
/** "+ Jože", "++ Jože in Ana" → "Jože in Ana", deceased. */
const stripMarks = (v: string): { text: string; deceased: boolean } => {
  const m = v.trim().match(/^\+{1,2}\s*(.*)$/);
  return m ? { text: m[1].replace(/\s\+{1,2}\s/g, " "), deceased: true } : { text: v.trim(), deceased: false };
};
const nextId = (prefix: string, ids: string[]) => `${prefix}${Math.max(0, ...ids.filter((i) => i.startsWith(prefix)).map((i) => Number(i.slice(prefix.length)) || 0)) + 1}`;

// ── Flag question ──────────────────────────────────────────────────────────

/** One flag's question: the options as chips, or "Popravi sam" with an input. */
function Question({ id, flag, current, churches, churchName, onPick }: {
  id: string;
  flag: BulletinFlag;
  /** The value now in the draft (for "Popravi sam" and the time labels). */
  current: { text?: string; time?: string; date?: string; churchSlug?: string };
  churches: Church[];
  churchName: (s: string) => string;
  onPick: (v: string) => void;
}) {
  const [fixing, setFixing] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const fid = `fix-${id}`;
  const f = flag;
  const open = () => {
    setErr(null);
    setFixing(
      f.field === "time" ? fT(f.options[0] ?? current.time ?? "") : f.field === "date" ? (current.date ?? f.options[0]) : f.field === "church" ? (current.churchSlug ?? f.options[0]) : f.field === "text" ? (current.text ?? "") : "",
    );
  };
  const apply = () => {
    const v = (fixing ?? "").trim();
    if (!v) return setErr("Vpišite popravek.");
    if (f.field === "time") {
      const t = parseTime(v);
      if (!t) return setErr("Vpišite uro, npr. 18.30.");
      return onPick(t);
    }
    if (v.length > 200) return setErr("Največ 200 znakov.");
    onPick(v);
  };
  return (
    <div className="qbox">
      <p>{f.question}</p>
      {fixing != null ? (
        <>
          <div className="fixrow">
            <label className="sr" htmlFor={fid}>
              Popravek
            </label>
            {f.field === "church" ? (
              <select className="input" id={fid} value={fixing} onChange={(e) => setFixing(e.target.value)} autoFocus>
                {churches.map((c) => (
                  <option key={c.slug} value={c.slug}>
                    {c.name}
                  </option>
                ))}
              </select>
            ) : (
              <input
                className="input"
                id={fid}
                type={f.field === "date" ? "date" : "text"}
                inputMode={f.field === "time" ? "decimal" : undefined}
                value={fixing}
                autoFocus
                aria-invalid={err ? true : undefined}
                aria-describedby={err ? `${fid}-err` : undefined}
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
            <small className="fixerr" id={`${fid}-err`} role="alert">
              {err}
            </small>
          ) : null}
        </>
      ) : (
        <div className="chips">
          {f.options.map((o) => (
            <button key={o} type="button" className="chip" onClick={() => onPick(o)}>
              {optionLabel(current, f, o, churchName)}
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

// ── One intention: shown, or edited in place ────────────────────────────────

/** The Masses an intention of this day can go to: the schedule's, plus the ones already used. */
function slotsOf(date: string, masses: SlotMass[], used: DraftIntention[]): { time: string; churchSlug: string }[] {
  const all = [...masses.filter((m) => m.date === date), ...used].map((m) => ({ time: m.time, churchSlug: m.churchSlug }));
  const seen = new Set<string>();
  return all.filter((s) => (seen.has(`${s.time}|${s.churchSlug}`) ? false : (seen.add(`${s.time}|${s.churchSlug}`), true))).sort((a, b) => a.time.localeCompare(b.time));
}

/** Text, kind and Mass of an intention: the editor of an existing one and the "Dodaj namen" form. */
function IntentionForm({ date, initial, slots, churches, churchName, onSave, onCancel, onRemove }: {
  date: string;
  initial?: DraftIntention;
  slots: { time: string; churchSlug: string }[];
  churches: Church[];
  churchName: (s: string) => string;
  onSave: (v: { text: string; kind: Kind; time: string; churchSlug: string }) => void;
  onCancel: () => void;
  onRemove?: () => void;
}) {
  const last = slots[slots.length - 1];
  const [text, setText] = useState(initial?.text ?? "");
  const [kind, setKind] = useState<Kind>(initial?.kind ?? "deceased");
  const [slot, setSlot] = useState(initial ? `${initial.time}|${initial.churchSlug}` : last ? `${last.time}|${last.churchSlug}` : "");
  const [time, setTime] = useState("");
  const [church, setChurch] = useState(churches[0]?.slug ?? "");
  const [err, setErr] = useState<string | null>(null);
  const id = `int-${initial?.id ?? `new-${date}`}`;
  const save = () => {
    const s = stripMarks(text);
    if (!s.text) return setErr("Vpišite, za koga se daruje.");
    if (s.text.length > 200) return setErr("Največ 200 znakov.");
    let t: string, c: string;
    if (slots.length) [t, c] = slot.split("|");
    else {
      const p = parseTime(time);
      if (!p) return setErr("Vpišite uro maše, npr. 18.30.");
      [t, c] = [p, church];
    }
    onSave({ text: s.text, kind: s.deceased ? "deceased" : kind, time: t, churchSlug: c });
  };
  return (
    <div className="iform">
      <label className="field">
        <span>Namen</span>
        <input
          id={id}
          value={text}
          autoFocus
          autoComplete="off"
          placeholder="npr. Jože Novak, obl."
          aria-invalid={err ? true : undefined}
          onChange={(e) => {
            setText(e.target.value);
            setErr(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              save();
            }
            if (e.key === "Escape") onCancel();
          }}
        />
      </label>
      <ChipGroup label="Vrsta namena" options={KINDS} value={kind} onChange={setKind} />
      {slots.length > 1 || (slots.length === 1 && initial) ? (
        <div className="chips" role="group" aria-label="Maša">
          {slots.map((s) => {
            const k = `${s.time}|${s.churchSlug}`;
            return (
              <Chip key={k} pressed={slot === k} onClick={() => setSlot(k)}>
                <span className="tnum">{fT(s.time)}</span> · {churchName(s.churchSlug)}
              </Chip>
            );
          })}
        </div>
      ) : slots.length === 0 ? (
        <div className="row2">
          <label className="field">
            <span>Ura maše</span>
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
      ) : (
        <p className="wsum">
          Maša ob {fT(slots[0].time)}, {churchName(slots[0].churchSlug)}
        </p>
      )}
      {err ? (
        <small className="fixerr" role="alert">
          {err}
        </small>
      ) : null}
      <div className="acts">
        <Button variant="primary" icon={initial ? "check" : "plus"} onClick={save}>
          {initial ? "Shrani" : "Dodaj namen"}
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          Prekliči
        </Button>
        {onRemove ? (
          <Button variant="ghost-danger" icon="trash" onClick={onRemove} className="ml-auto">
            Odstrani
          </Button>
        ) : null}
      </div>
    </div>
  );
}

// ── One day of the month ────────────────────────────────────────────────────

function Day({ date, day, masses, picks, churches, churchName, numbers, newId, onDay, onPick }: {
  date: string;
  day: DraftDay | undefined;
  masses: SlotMass[];
  picks: Record<string, string>;
  churches: Church[];
  churchName: (s: string) => string;
  /** The flag's running number ("1", "2" …) by intention id. */
  numbers: Map<string, number>;
  /** A fresh intention id, unique in the whole draft. */
  newId: () => string;
  onDay: (d: DraftDay) => void;
  onPick: (id: string, v: string) => void;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const d: DraftDay = day ?? { date, tags: [], intentions: [] };
  const sunday = isSunday(date);
  const shown = d.intentions.map((raw) => ({ raw, it: resolved(raw, picks[raw.id]) }));
  // Group by Mass, like the site's MassRow: one time, one church, its intentions.
  const groups: { key: string; time: string; churchSlug: string; rows: typeof shown }[] = [];
  for (const s of [...shown].sort((a, b) => a.it.time.localeCompare(b.it.time))) {
    const key = `${s.it.time}|${s.it.churchSlug}`;
    const g = groups.find((x) => x.key === key);
    if (g) g.rows.push(s);
    else groups.push({ key, time: s.it.time, churchSlug: s.it.churchSlug, rows: [s] });
  }
  const slots = slotsOf(date, masses, d.intentions);
  const empty = !d.intentions.length && !d.title && !d.sundayName && !d.tags.length;

  return (
    <li className={cn("mday", empty && "empty", sunday && "sun")} aria-labelledby={`dan-${date}`}>
      <DayLeaf date={date} />
      <div className="min-w-0">
        <div className="mday-h" id={`dan-${date}`}>
          {d.sundayName ? <p className="sname">{d.sundayName}</p> : null}
          {d.title && d.title !== d.sundayName ? <p className="lit">{d.title}</p> : null}
          {d.gospel ? <p className="gospel">{d.gospel}</p> : null}
          {d.tags.length ? (
            <p className="tags">
              {d.tags.map((t) => (
                <Pill key={t} tone="line">
                  {t}
                </Pill>
              ))}
            </p>
          ) : null}
        </div>
        {groups.length ? (
          <ul className="mmass">
            {groups.map((g) => (
              <li key={g.key}>
                <time className="mt">{fT(g.time)}</time>
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
                    <ChurchPill name={churchName(g.churchSlug)} dark={false} muted={false} />
                  </p>
                  <ul className="mints">
                    {g.rows.map(({ raw, it }) => {
                      const f = raw.flag;
                      const pick = picks[raw.id];
                      if (editing === raw.id)
                        return (
                          <li key={raw.id} className="editing">
                            <IntentionForm
                              date={date}
                              initial={it}
                              slots={slots}
                              churches={churches}
                              churchName={churchName}
                              onCancel={() => setEditing(null)}
                              onRemove={() => {
                                onDay({ ...d, intentions: d.intentions.filter((x) => x.id !== raw.id) });
                                setEditing(null);
                              }}
                              onSave={(v) => {
                                const changedFlagged = f && ((f.field === "text" && v.text !== it.text) || (f.field === "time" && v.time !== it.time) || (f.field === "church" && v.churchSlug !== it.churchSlug));
                                onDay({ ...d, intentions: d.intentions.map((x) => (x.id === raw.id ? { ...x, ...v } : x)) });
                                // Correcting the flagged value by hand answers its question.
                                if (changedFlagged) onPick(raw.id, f.field === "text" ? v.text : f.field === "time" ? v.time : v.churchSlug);
                                setEditing(null);
                              }}
                            />
                          </li>
                        );
                      return (
                        <li key={raw.id} className={cn(f && !pick && "flag", f && pick && "checked")}>
                          <div className="irow">
                            {f && !pick ? <span className="qn">{numbers.get(raw.id)}</span> : null}
                            <span className="pre" aria-label={it.kind === "deceased" ? "za pokojne" : undefined} aria-hidden={it.kind === "deceased" ? undefined : true}>
                              {pre(it.kind)}
                            </span>
                            <span className="itext">
                              {it.text}
                              {it.kind === "thanksgiving" ? <small> · zahvala</small> : null}
                              {f && pick ? <span className="okpill">preverjeno</span> : null}
                            </span>
                            <IconButton icon="pen" label={`Uredi namen ${it.text}`} className="ied" onClick={() => setEditing(raw.id)} />
                          </div>
                          {f && !pick ? (
                            <Question id={raw.id} flag={f} current={{ ...it, date }} churches={churches} churchName={churchName} onPick={(v) => onPick(raw.id, v)} />
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </li>
            ))}
          </ul>
        ) : null}
        {adding ? (
          <IntentionForm
            date={date}
            slots={slots}
            churches={churches}
            churchName={churchName}
            onCancel={() => setAdding(false)}
            onSave={(v) => {
              onDay({ ...d, intentions: [...d.intentions, { id: newId(), ...v }] });
              setAdding(false);
            }}
          />
        ) : (
          <button type="button" className="addline sm" onClick={() => setAdding(true)}>
            <Icon name="plus" />
            Dodaj namen
          </button>
        )}
      </div>
    </li>
  );
}

// ── Events found in the notices ─────────────────────────────────────────────

function EventCard({ ev, n, pick, churches, churchName, onChange, onPick }: {
  ev: DraftEvent;
  n: number;
  pick: string | undefined;
  churches: Church[];
  churchName: (s: string) => string;
  onChange: (e: DraftEvent) => void;
  onPick: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [time, setTime] = useState(ev.time ? fT(ev.time) : "");
  const f = ev.include ? ev.flag : undefined;
  return (
    <li className={cn("evc", !ev.include && "off", f && !pick && "flag")}>
      <Switch
        label={
          <>
            {f && !pick ? <span className="qn">{n}</span> : null}
            {ev.title}
            {f && pick ? <span className="okpill">preverjeno</span> : null}
          </>
        }
        hint={ev.include ? eventWhen(resolvedEvent(ev, pick)) : `${eventWhen(ev)} · ne bo objavljeno`}
        checked={ev.include}
        onChange={(on) => onChange({ ...ev, include: on })}
      />
      {f && !pick ? <Question id={ev.id} flag={f} current={{ text: ev.title, date: ev.date, time: ev.time }} churches={churches} churchName={churchName} onPick={onPick} /> : null}
      {open ? (
        <div className="evform">
          <label className="field">
            <span>Naslov</span>
            <input value={ev.title} maxLength={200} onChange={(e) => onChange({ ...ev, title: e.target.value })} />
          </label>
          <div className="r3">
            <label className="field">
              <span>Datum</span>
              <input type="date" value={ev.date} onChange={(e) => e.target.value && onChange({ ...ev, date: e.target.value })} />
            </label>
            <label className="field">
              <span>Ura</span>
              <input
                value={time}
                inputMode="decimal"
                placeholder="19.15"
                aria-invalid={err ? true : undefined}
                onChange={(e) => {
                  setTime(e.target.value);
                  setErr(null);
                  const v = e.target.value.trim();
                  if (!v) return onChange({ ...ev, time: undefined });
                  const t = parseTime(v);
                  if (t) onChange({ ...ev, time: t });
                }}
                onBlur={() => time.trim() && !parseTime(time) && setErr("Vpišite uro, npr. 19.15.")}
              />
            </label>
            <label className="field">
              <span>Kraj</span>
              <input value={ev.place ?? ""} placeholder="npr. župnišče" onChange={(e) => onChange({ ...ev, place: e.target.value || undefined })} />
            </label>
          </div>
          {err ? (
            <small className="fixerr" role="alert">
              {err}
            </small>
          ) : null}
          <div className="acts">
            <Button variant="ghost" icon="check" onClick={() => setOpen(false)}>
              Končano
            </Button>
          </div>
        </div>
      ) : (
        <button type="button" className="addline sm" onClick={() => setOpen(true)}>
          <Icon name="pen" />
          Uredi
        </button>
      )}
    </li>
  );
}

// ── Article and prayer intention ───────────────────────────────────────────

function TextBlock({ label, value, onChange, onRemove }: {
  label: string;
  value: { title: string; text: string };
  onChange: (v: { title: string; text: string }) => void;
  onRemove: () => void;
}) {
  const first = value.text.split(/\n+/)[0] ?? "";
  return (
    <details className="tblock">
      <summary>
        <span className="eyebrow">{label}</span>
        <b>{value.title || "Brez naslova"}</b>
        <span className="pv">{first}</span>
        <span className="more">
          <Icon name="pen" />
          Preberi in uredi
        </span>
      </summary>
      <div className="tbody">
        <label className="field">
          <span>Naslov</span>
          <input value={value.title} onChange={(e) => onChange({ ...value, title: e.target.value })} />
        </label>
        <label className="field">
          <span>Besedilo</span>
          <textarea className="long" value={value.text} onChange={(e) => onChange({ ...value, text: e.target.value })} />
        </label>
        <div className="acts">
          <Button variant="ghost-danger" icon="trash" onClick={onRemove}>
            Ne objavi
          </Button>
        </div>
      </div>
    </details>
  );
}

// ── The review ──────────────────────────────────────────────────────────────

export function Review(p: {
  draft: ReadableDraft;
  picks: Record<string, string>;
  churches: Church[];
  masses: SlotMass[];
  approval: boolean;
  busy: Busy;
  /** Informative, not an error: the month is past or already published. */
  notice?: React.ReactNode;
  onDraft: (d: ReadableDraft) => void;
  onPick: (id: string, v: string) => void;
  onPublish: () => void;
  onSave: () => void;
  onDiscard: () => void;
}) {
  const [confirm, setConfirm] = useState(false);
  const { draft } = p;
  const churchName = (s: string) => p.churches.find((c) => c.slug === s)?.name ?? s;
  const ints = draft.days.flatMap((d) => d.intentions);
  const newId = () => nextId("h", ints.map((i) => i.id));

  // Flags in reading order: intentions by date, then events.
  const numbers = new Map<string, number>();
  for (const i of ints) if (i.flag && !p.picks[i.id]) numbers.set(i.id, numbers.size + 1);
  for (const e of draft.events) if (e.include && e.flag && !p.picks[e.id]) numbers.set(e.id, numbers.size + 1);
  // Unplaced notices must be kept or removed before publishing, so they count as open too.
  const open = numbers.size + draft.notices.filter((n) => isUnplaced(n.text)).length;
  const notices = draft.notices.filter((n) => n.text.trim()).length;
  const events = draft.events.filter((e) => e.include).length;
  const empty = !ints.length && !notices && !events;
  const span = periodName(draft.period);

  const byDate = new Map(draft.days.map((d) => [d.date, d]));
  const all = dateRange(draft.period.start, draft.period.end).map((date) => ({ date, day: byDate.get(date) }));
  const weeks = weeksOf(all);

  const setDay = (d: DraftDay) => {
    const days = byDate.has(d.date) ? draft.days.map((x) => (x.date === d.date ? d : x)) : [...draft.days, d].sort((a, b) => a.date.localeCompare(b.date));
    p.onDraft({ ...draft, days });
  };
  const setNotice = (i: number, text: string) => p.onDraft({ ...draft, notices: draft.notices.map((n, j) => (j === i ? { ...n, text } : n)) });
  const addNotice = () => {
    const id = nextId("n", draft.notices.map((n) => n.id));
    p.onDraft({ ...draft, notices: [...draft.notices, { id, text: "" }] });
    requestAnimationFrame(() => document.getElementById(`news-${id}`)?.focus());
  };
  const setEvent = (e: DraftEvent) => p.onDraft({ ...draft, events: draft.events.map((x) => (x.id === e.id ? e : x)) });

  return (
    <div className="draft">
      {p.notice ? (
        <div className="banner gold" role="status">
          {p.notice}
        </div>
      ) : null}

      <div className="dsum">
        <Pill tone="line">{pl(ints.length, NAM)}</Pill>
        <Pill tone="line">{pl(notices, OBV)}</Pill>
        <Pill tone="line">{pl(events, SRE)}</Pill>
        {open ? <Pill tone="gold">{toCheck(open)}</Pill> : ints.length ? <Pill icon="check">vse preverjeno</Pill> : null}
      </div>

      <section className="blk" aria-labelledby="h-nameni">
        <h3 id="h-nameni">Mašni nameni</h3>
        {weeks.map((w) => {
          const a = w.days[0].date;
          const b = w.days[w.days.length - 1].date;
          return (
            <div key={w.start} className="mweek">
              <h4 className="mweek-h">{fSpan(a, b)}</h4>
              <ol className="mdays">
                {w.days.map(({ date, day }) => (
                  <Day key={date} date={date} day={day} masses={p.masses} picks={p.picks} churches={p.churches} churchName={churchName} numbers={numbers} newId={newId} onDay={setDay} onPick={p.onPick} />
                ))}
              </ol>
            </div>
          );
        })}
      </section>

      <section className="blk" aria-labelledby="h-obv">
        <h3 id="h-obv">Obvestila</h3>
        <ol className="news">
          {draft.notices.map((n, i) => {
            const remove = () => p.onDraft({ ...draft, notices: draft.notices.filter((x) => x.id !== n.id) });
            // A part of the document the reader couldn't place (the format may have changed).
            if (isUnplaced(n.text))
              return (
                <li key={n.id} className="unplaced">
                  <p>Claude tega ni znal razvrstiti. Če se to ponavlja, dopolnite navodila za branje.</p>
                  <label className="sr" htmlFor={`news-${n.id}`}>
                    Nerazvrščeno besedilo {i + 1}
                  </label>
                  <textarea id={`news-${n.id}`} rows={2} value={placed(n.text)} onChange={(e) => setNotice(i, `Ni razvrščeno: ${e.target.value}`)} />
                  <div className="chips">
                    <button type="button" className="chip" onClick={() => setNotice(i, placed(n.text))}>
                      <Icon name="check" />
                      Ohrani kot obvestilo
                    </button>
                    <button type="button" className="chip" onClick={remove}>
                      <Icon name="trash" />
                      Odstrani
                    </button>
                  </div>
                </li>
              );
            return (
              <li key={n.id}>
                <label className="sr" htmlFor={`news-${n.id}`}>
                  Obvestilo {i + 1}
                </label>
                <textarea id={`news-${n.id}`} rows={2} value={n.text} onChange={(e) => setNotice(i, e.target.value)} />
                <IconButton icon="x" label={`Odstrani obvestilo ${i + 1}`} onClick={remove} />
              </li>
            );
          })}
        </ol>
        <button type="button" className="addline" onClick={addNotice}>
          <Icon name="plus" />
          Dodaj obvestilo
        </button>
      </section>

      {draft.events.length ? (
        <section className="blk" aria-labelledby="h-ev">
          <h3 id="h-ev">Srečanja in dogodki iz obvestil</h3>
          <p className="wsum">Vključeni bodo objavljeni med dogodki. Izklopite tiste, ki ne sodijo na stran.</p>
          <ul className="evs">
            {draft.events.map((e) => (
              <EventCard
                key={e.id}
                ev={e}
                n={numbers.get(e.id) ?? 0}
                pick={p.picks[e.id]}
                churches={p.churches}
                churchName={churchName}
                onChange={setEvent}
                onPick={(v) => p.onPick(e.id, v)}
              />
            ))}
          </ul>
        </section>
      ) : null}

      {draft.article || draft.prayerIntention ? (
        <section className="blk" aria-labelledby="h-txt">
          <h3 id="h-txt">Članek in molitveni namen</h3>
          {draft.article ? <TextBlock label="Članek" value={draft.article} onChange={(article) => p.onDraft({ ...draft, article })} onRemove={() => p.onDraft({ ...draft, article: undefined })} /> : null}
          {draft.prayerIntention ? (
            <TextBlock
              label="Molitveni namen"
              value={draft.prayerIntention}
              onChange={(prayerIntention) => p.onDraft({ ...draft, prayerIntention })}
              onRemove={() => p.onDraft({ ...draft, prayerIntention: undefined })}
            />
          ) : null}
        </section>
      ) : null}

      <div className="actionbar">
        {confirm ? (
          <div className="banner alert" role="alertdialog" aria-labelledby="discard-q">
            <b id="discard-q">Zavržem ta osnutek?</b>
            <p>Nič ni bilo objavljeno. Oznanila za {span} boste lahko naložili znova.</p>
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
                  ? "Dodajte vsaj en namen ali obvestilo"
                  : p.busy === "publish"
                    ? p.approval
                      ? "Pošiljam …"
                      : "Objavljam …"
                    : p.approval
                      ? "Pošlji župniku"
                      : `Objavi oznanila za ${span}`}
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
