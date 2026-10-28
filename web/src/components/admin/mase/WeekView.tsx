"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Icon } from "@/components/admin/Icon";
import { Button, PageHead, Pill } from "@/components/admin/ui";
import { ChurchPill, DayLeaf, StatusPill } from "@/components/masses/MassList";
import { dayLabel } from "@/lib/mase/format";
import { cn } from "@/lib/utils";
import type { MassView, Week } from "@/lib/mase/queries";
import { firstName, fT, kindPrefix, MAS, pl, typeShort, weekWord } from "./format";
import { IntentionPanel, type UpcomingMass } from "./IntentionPanel";
import { MassPanel, type PanelMass } from "./MassPanel";
import { useTedenUrl } from "./useTedenUrl";

export type Viewer = { id: string; isOwner: boolean; approval: boolean; canUpload: boolean };

/** `w` for the week link (null = this week, no parameter). */
export type WeekLink = { w: string | null } | null;

export function WeekView({ viewer, today, week, span, offset, prev, next, extraMass, upcoming, sitePreview, tabs }: {
  viewer: Viewer;
  /** "Nameni | Prošnje (n)" (components/admin/requests/Tabs.tsx). */
  tabs?: React.ReactNode;
  /** "Na strani": the public Mašni nameni page for this week, rendered on the server (SitePreview). */
  sitePreview: React.ReactNode;
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
      {tabs}
      {bar}
      {url.preview ? (
        <div className="preview" style={busy}>
          <div className="browser">
            <i />
            <i />
            <i />
            <span>zupnija-pirnice.si/masni-nameni</span>
          </div>
          {sitePreview}
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
          {/* Each day: the site's day leaf and weekday above a white group of MassRows. */}
          <div className="days" style={busy}>
            {days.map((d) => (
              <section key={d.date} aria-labelledby={`dan-${d.date}`} className="day">
                <header>
                  <DayLeaf date={d.date} />
                  <div className="min-w-0">
                    <h2 id={`dan-${d.date}`} className="text-[1.125rem] font-semibold leading-tight tracking-[-0.025em] text-ink capitalize">
                      {d.weekday}
                    </h2>
                    {d.feast ? <p className="mt-0.5 text-meta text-ink-3">{d.feast}</p> : null}
                  </div>
                  {d.date === today ? (
                    <Pill className="ml-auto self-center">danes</Pill>
                  ) : null}
                </header>
                <ul className="grp">
                  {d.masses.map((m) => (
                    <li key={m.id}>
                      <MassRow m={m} viewer={viewer} onOpen={() => url.openMass(m.id)} />
                    </li>
                  ))}
                </ul>
              </section>
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

/**
 * One Mass, laid out like the site's MassRow (components/masses/MassList.tsx):
 * large tabular time, type, outlined church pill, status pills, intentions with
 * the gold prefix. As a button it opens the Mass panel; pending intentions and
 * "brez namena" are the editor's additions.
 */
function MassRow({ m, viewer, onOpen }: { m: MassView; viewer: Viewer; onOpen: () => void }) {
  const off = m.status === "cancelled";
  const none = !m.intentions.length && !m.pending.length;
  return (
    <button
      type="button"
      className="mrow grid grid-cols-[4.25rem_minmax(0,1fr)_auto] gap-x-4 py-3.5"
      onClick={onOpen}
      aria-label={`${dayLabel(m.date)}, ${fT(m.time)}, ${m.church}`}
    >
      <time
        dateTime={m.time}
        className={cn(
          "whitespace-nowrap pt-0.5 text-[1.375rem] font-semibold tabular-nums leading-none tracking-[-0.045em]",
          off ? "text-ink-3 line-through decoration-1" : "text-ink",
        )}
      >
        {fT(m.time)}
      </time>
      <div className="min-w-0">
        <p className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5 text-small">
          <span className={cn("font-medium", off && "text-ink-3 line-through")}>{typeShort(m.type)}</span>
          <ChurchPill name={m.church} dark={false} muted={off} />
          {off ? (
            <StatusPill tone="alert" dark={false}>
              Odpade
            </StatusPill>
          ) : null}
          {m.pendingCancel ? (
            <StatusPill tone="gold" dark={false}>
              odpoved čaka župnika
            </StatusPill>
          ) : null}
        </p>
        {off && m.cancelReason ? <p className="mt-1.5 text-small text-alert">{m.cancelReason}</p> : null}
        {off ? null : (
          <ul className="ints mt-2 space-y-1 text-small text-ink-2">
            {none ? (
              <li className="flex gap-2">
                <span className="w-3 shrink-0" aria-hidden="true" />
                <span className="italic text-ink-3">brez namena</span>
              </li>
            ) : null}
            {m.intentions.map((i) => (
              <li key={i.id} className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                <span className="w-3 shrink-0 text-center text-gold">{kindPrefix(i.kind)}</span>
                <span>{i.text}</span>
                {i.movedFromMassId ? <Pill tone="line">prestavljen</Pill> : null}
              </li>
            ))}
            {m.pending.map((p) => (
              <li key={`p${p.changeRequestId}`} className="pend flex flex-wrap items-baseline gap-x-2 gap-y-1">
                <span className="w-3 shrink-0 text-center text-gold">{kindPrefix(p.kind)}</span>
                <span>{p.text}</span>
                <Pill tone="gold">{p.createdBy === viewer.id ? "čaka župnika" : `čaka potrditev · ${firstName(p.createdByName)}`}</Pill>
              </li>
            ))}
          </ul>
        )}
      </div>
      <span className="chev">
        <Icon name="r" />
      </span>
    </button>
  );
}
