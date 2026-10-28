import Link from "next/link";
import { formatDayHeading } from "@/lib/dates";
import { routes } from "@/lib/routes";
import { countdownChip, timelinePercent, widgetDayLabel, type TodayBlock, type TodayMass } from "@/lib/data/today";
import { cn } from "@/lib/utils";
import s from "./home.module.css";

/**
 * The "Danes" widget docked under the photograph: whether there is Mass
 * today, when, where and for whom (US-002). Four modes, see lib/data/today.ts.
 */
export function TodayWidget({ block }: { block: TodayBlock }) {
  const { mode, next } = block;
  const cancelled = block.today.filter((m) => m.cancelled);
  const chip = cancelled.length && mode !== "none-at-all" ? null : countdownChip(block);
  const alertChip = cancelled.length ? (cancelled.length === 1 ? "ena maša odpade" : `${cancelled.length} maše odpadejo`) : null;

  return (
    <div className={s.widget} role="region" aria-label="Danes">
      <div className={s.top}>
        {mode === "today" ? (
          <span className={s.live}>{widgetDayLabel(block.date, block.date)}</span>
        ) : mode === "tomorrow" && next ? (
          <span>{widgetDayLabel(next.date, block.date)}</span>
        ) : (
          <span>{formatDayHeading(block.date)}</span>
        )}
        {alertChip ? <span className={cn(s.chip, s.chipAlert)}>{alertChip}</span> : chip ? <span className={s.chip}>{chip}</span> : null}
      </div>

      {(mode === "today" || mode === "tomorrow") && next ? (
        <>
          <h2 className="sr-only">{block.headline}</h2>
          <div className={s.whead} aria-hidden="true">
            <span className={s.t}>{next.label}</span>
            {block.following.length ? <span className={s.t2}>nato {block.following.map((m) => m.label).join(", ")}</span> : null}
          </div>
          <p className={s.place}>{place(next, block.following)}</p>
          {mode === "today" ? <Timeline block={block} /> : null}
          <Intentions masses={[next, ...block.following]} />
          {mode === "today" ? <Earlier masses={block.today.filter((m) => m.past && !m.cancelled)} /> : null}
          {mode === "tomorrow" ? (
            <p className={cn(s.note, s.noteSoft)}>
              Današnje maše so že mimo: <s>{block.earlierToday.join(", ")}</s>.
            </p>
          ) : null}
        </>
      ) : mode === "none-today" && next ? (
        <>
          <h2 className={s.msg}>{block.headline}.</h2>
          <p className={s.sub}>
            Naslednja: {nextDay(next, block.date)} ob <b>{next.label}</b>, {next.church}.
          </p>
          <Intentions masses={[next, ...block.following]} timed />
        </>
      ) : (
        <>
          <h2 className={s.msg}>{block.headline}.</h2>
          <p className={s.sub}>Razpored rednih svetih maš je na strani Svete maše.</p>
        </>
      )}

      {cancelled.map((m) => (
        <p key={m.key} className={cn(s.note, s.noteAlert)}>
          Sveta maša ob {m.label} ({m.church}) danes odpade.{m.cancelReason ? ` ${m.cancelReason}` : ""}
        </p>
      ))}

      <div className={s.acts}>
        <Link className={s.btn} href={routes.masses}>
          Maše tega tedna
        </Link>
        <Link className={s.ghost} href={routes.intentions}>
          Mašni nameni
        </Link>
      </div>
    </div>
  );
}

function place(next: TodayMass, following: TodayMass[]): string {
  const churches = [next.church, ...following.map((m) => m.church)].filter((c, i, a) => c && a.indexOf(c) === i);
  if (churches.length > 1) return churches.join(", nato ");
  return [next.kind, next.church].filter(Boolean).join(" · ");
}

function nextDay(next: TodayMass, base: string): string {
  const label = widgetDayLabel(next.date, base);
  if (label.startsWith("Jutri")) return "jutri";
  return label.charAt(0).toLowerCase() + label.slice(1);
}

/** The headline Mass's intentions; with several Masses, each line starts with its time. */
function Intentions({ masses, timed }: { masses: TodayMass[]; timed?: boolean }) {
  const withTime = timed || masses.length > 1;
  return (
    <ul className={s.ints}>
      {masses.flatMap((m) =>
        m.intentions.length
          ? m.intentions.map((text, n) => (
              <li key={`${m.key}-${n}`}>
                {withTime ? <b>{m.label}</b> : null}
                {text}
              </li>
            ))
          : [
              <li key={m.key} className={s.empty}>
                {withTime ? <b>{m.label}</b> : null}
                Namen še ni vpisan.
              </li>,
            ],
      )}
    </ul>
  );
}

/** Today's Masses that are over, struck through, with their intentions. */
function Earlier({ masses }: { masses: TodayMass[] }) {
  if (!masses.length) return null;
  return (
    <ul className={s.ints} style={{ marginTop: 6 }}>
      {masses.map((m) => (
        <li key={m.key} className={s.muted}>
          Že mimo: <s>{m.label}</s> {m.church}
          {m.intentions.length ? `: ${m.intentions.join("; ")}` : ""}
        </li>
      ))}
    </ul>
  );
}

/** The day from 6.00 to 21.00: a dot per Mass, the gold line up to now and the "zdaj" marker. */
function Timeline({ block }: { block: TodayBlock }) {
  const now = timelinePercent(block.time);
  const marks = block.today.map((m) => ({ m, at: timelinePercent(m.time) }));
  // The "zdaj" label hides when it would sit on a Mass's time.
  const nowLabel = now > 0 && now < 100 && marks.every(({ at }) => Math.abs(at - now) > 9);
  return (
    <div className={s.tl} aria-hidden="true">
      <span className={s.done} style={{ width: `${now}%` }} />
      {marks.map(({ m, at }) => (
        <span key={m.key} className={cn(s.m, m.cancelled ? s.mOff : m.past ? s.mPast : m.key === block.next?.key ? s.mNext : null)} style={{ left: `${at}%` }} />
      ))}
      {now > 0 && now < 100 ? <span className={s.now} style={{ left: `${now}%` }} /> : null}
      {marks.map(({ m, at }) => (
        <span key={`x-${m.key}`} className={cn(s.x, m.cancelled && s.xOff)} style={{ left: `${at}%` }}>
          {m.label}
        </span>
      ))}
      {nowLabel ? (
        <span className={cn(s.x, s.xNow)} style={{ left: `${now}%` }}>
          zdaj
        </span>
      ) : null}
    </div>
  );
}
