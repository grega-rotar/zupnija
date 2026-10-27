"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Icon } from "@/components/admin/Icon";
import { Button, PageHead } from "@/components/admin/ui";
import { dayLabel } from "@/lib/mase/format";
import type { MassView, Week } from "@/lib/mase/queries";
import { firstName, fT, kindPrefix, MAS, pl, typeShort, weekWord } from "./format";
import { IntentionPanel, type UpcomingMass } from "./IntentionPanel";
import { MassPanel, type PanelMass } from "./MassPanel";
import { useTedenUrl } from "./useTedenUrl";

export type Viewer = { id: string; isOwner: boolean; approval: boolean; canUpload: boolean };

/** `w` for the week link (null = this week, no parameter). */
export type WeekLink = { w: string | null } | null;

export function WeekView({ viewer, today, week, span, offset, prev, next, extraMass, upcoming }: {
  viewer: Viewer;
  today: string;
  week: Week;
  /** "26. okt – 1. nov" */
  span: string;
  /** Weeks after this one (0 = this week). */
  offset: number;
  prev: WeekLink;
  next: WeekLink;
  /** The `?masa=` Mass when it isn't in this week. */
  extraMass: PanelMass | null;
  /** For `?nov=1`. */
  upcoming: UpcomingMass[] | null;
}) {
  const url = useTedenUrl();
  const router = useRouter();
  const [loading, startTransition] = useTransition();
  const goWeek = (l: WeekLink) => l && startTransition(() => url.goWeek(l.w));

  const days = week.days.filter((d) => d.masses.length > 0);
  const live = week.counts.masses - week.counts.cancelled;
  const empty = week.counts.withoutIntention;
  const word = weekWord(offset);

  const open = url.massId ? findMass(week, url.massId) ?? (extraMass?.id === url.massId ? extraMass : null) : null;

  const head = (
    <PageHead
      title="Maše in nameni"
      sub="Tapnite mašo, da dodate namen ali jo odpoveste."
      action={
        <Button variant="primary" icon="plus" onClick={url.openNew}>
          Dodaj namen
        </Button>
      }
    />
  );

  const bar = (
    <div className="weekbar">
      <div className="wnav">
        <button type="button" aria-label="Prejšnji teden" disabled={!prev} onClick={() => goWeek(prev)}>
          <Icon name="l" />
        </button>
        <strong>{span}</strong>
        <button type="button" aria-label="Naslednji teden" disabled={!next} onClick={() => goWeek(next)}>
          <Icon name="r" />
        </button>
      </div>
      <span className="wsum">
        {word} · {pl(live, MAS)}
        {empty ? (
          <>
            {" · "}
            <b>{empty} brez namena</b>
          </>
        ) : null}
      </span>
      <div className="seg" role="group" aria-label="Pogled">
        <button type="button" aria-pressed={!url.preview} onClick={() => url.setView(false)}>
          <Icon name="pen" />
          Urejanje
        </button>
        <button type="button" aria-pressed={url.preview} onClick={() => url.setView(true)}>
          <Icon name="eye" />
          Na strani
        </button>
      </div>
    </div>
  );

  const busy = loading ? { opacity: 0.55, transition: "opacity .2s" } : undefined;

  return (
    <div className="page enter">
      {head}
      {bar}
      {url.preview ? (
        <div className="preview" style={busy}>
          <div className="browser">
            <i />
            <i />
            <i />
            <span>zupnija-pirnice.si/svete-mase</span>
          </div>
          <div className="pv">
            <h2>{offset <= 1 ? `Svete maše ${word}` : "Svete maše"}</h2>
            <p className="lede">{span}</p>
            <div className="days">
              {days.map((d) => (
                <div className="day" key={d.date}>
                  <div className="dl">
                    <b>{d.label}</b>
                    {d.feast ? <span className="feast">{d.feast}</span> : null}
                  </div>
                  <div className="mlist">
                    {d.masses.map((m) => (
                      <MassRow key={m.id} m={m} viewer={viewer} preview />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <>
          {week.isEmpty && viewer.canUpload ? (
            <div className="notice">
              <p>Redne maše so že vpisane po urniku. Manjkajo nameni in obvestila. Naložite oznanila ali vpišite namene ročno.</p>
              <div className="acts">
                <Button variant="primary" icon="cam" onClick={() => router.push("/oznanila/nalozi")}>
                  Fotografiraj oznanila
                </Button>
                <Button onClick={() => router.push("/oznanila/nalozi")}>Izberi datoteko</Button>
              </div>
            </div>
          ) : null}
          <div className="days" style={busy}>
            {days.map((d) => (
              <div className="day" key={d.date}>
                <div className="dl">
                  <b>{d.weekday}</b>
                  <span>{d.label.slice(d.label.indexOf(", ") + 2)}</span>
                  {d.feast ? <span className="feast">{d.feast}</span> : null}
                  {d.date === today ? <span className="pill today">danes</span> : null}
                </div>
                <div className="mlist">
                  {d.masses.map((m) => (
                    <MassRow key={m.id} m={m} viewer={viewer} onOpen={() => url.openMass(m.id)} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {open ? <MassPanel key={open.id} mass={open} viewer={viewer} onClose={url.close} /> : null}
      {url.isNew && upcoming ? <IntentionPanel masses={upcoming} viewer={viewer} onClose={url.close} /> : null}
    </div>
  );
}

function findMass(week: Week, id: number): PanelMass | null {
  for (const d of week.days) {
    const m = d.masses.find((x) => x.id === id);
    if (m) return { ...m, label: d.label, feast: d.feast };
  }
  return null;
}

function MassRow({ m, viewer, preview, onOpen }: { m: MassView; viewer: Viewer; preview?: boolean; onOpen?: () => void }) {
  const off = m.status === "cancelled";
  const pending = preview ? [] : m.pending;
  const none = !m.intentions.length && !pending.length;
  const inner = (
    <>
      <time className="tnum">{fT(m.time)}</time>
      <div className="mb">
        <p className="mw">
          <span>{typeShort(m.type)}</span>
          <span className="pill">{m.church}</span>
          {off ? <span className="pill alert">Odpade</span> : null}
          {!preview && m.pendingCancel ? <span className="pill gold">odpoved čaka župnika</span> : null}
        </p>
        {off && m.cancelReason ? <p className="reason">{m.cancelReason}</p> : null}
        {off || (preview && none) ? null : (
          <ul className="ints">
            {none ? (
              <li>
                <span className="pre" />
                <span className="none">brez namena</span>
              </li>
            ) : null}
            {m.intentions.map((i) => (
              <li key={i.id}>
                <span className="pre">{kindPrefix(i.kind)}</span>
                <span>{i.text}</span>
                {i.movedFromMassId ? <span className="pill line">prestavljen</span> : null}
              </li>
            ))}
            {pending.map((p) => (
              <li key={`p${p.changeRequestId}`} className="pend">
                <span className="pre">{kindPrefix(p.kind)}</span>
                <span>{p.text}</span>
                <span className="pill gold">
                  {p.createdBy === viewer.id ? "čaka župnika" : `čaka potrditev · ${firstName(p.createdByName)}`}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
  if (preview) return <div className={`mrow${off ? " off" : ""}`}>{inner}</div>;
  return (
    <button
      type="button"
      className={`mrow${off ? " off" : ""}`}
      onClick={onOpen}
      aria-label={`${dayLabel(m.date)}, ${fT(m.time)}, ${m.church}`}
    >
      {inner}
      <span className="chev">
        <Icon name="r" />
      </span>
    </button>
  );
}
