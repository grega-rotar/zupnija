import Link from "next/link";
import { bulletinLabel, type PublicBulletinWithEvents } from "@/lib/data/bulletins";
import type { PublicEvent } from "@/lib/data/events";
import { daysUntil, formatDaysUntil, missingBulletinNote, type WeekAheadDay } from "@/lib/data/today";
import type { LiturgicalDay } from "@/lib/liturgy/day";
import { hozanaUrl } from "@/lib/liturgy/hozana";
import { dateOf, formatDayHeading, formatMonthShort, formatTime, timeOf, WEEKDAY_LABEL, weekdayOf, type IsoDate } from "@/lib/dates";
import { routes } from "@/lib/routes";
import { cn } from "@/lib/utils";
import { Arrow } from "./Arrow";
import s from "./home.module.css";

type Props = {
  date: IsoDate;
  liturgy: LiturgicalDay | null;
  event: PublicEvent | null;
  bulletin: PublicBulletinWithEvents | null;
  week: WeekAheadDay[];
};

/** "Ta teden v župniji": the liturgical day, the next event, the bulletin and the Masses until Sunday (US-003, US-004). */
export function ThisWeek({ date, liturgy, event, bulletin, week }: Props) {
  return (
    <section className={cn(s.wrap, s.sec)} aria-labelledby="teden-h">
      <div className={cn(s.open, s.reveal)} data-reveal>
        <p className={s.eye}>{formatDayHeading(date)}</p>
        <h2 className={s.h2} id="teden-h">
          Ta teden <em className="accent">v župniji</em>
        </h2>
        <p className={s.subl}>Bogoslužni dan, naslednji dogodek, oznanila in svete maše do nedelje.</p>
      </div>
      <div className={s.bento}>
        <LiturgyTile date={date} liturgy={liturgy} />
        <EventTile date={date} event={event} />
        <BulletinTile date={date} bulletin={bulletin} />
        <WeekTile week={week} />
      </div>
    </section>
  );
}

const capitalise = (x: string) => x.charAt(0).toUpperCase() + x.slice(1);

function LiturgyTile({ date, liturgy }: { date: IsoDate; liturgy: LiturgicalDay | null }) {
  if (!liturgy) {
    return (
      <article className={cn(s.tile, s.lit, s.reveal)} data-reveal>
        <span className={s.tag}>
          <span className={s.dot} />
          Bogoslužni dan
        </span>
        <h3>Berila dneva</h3>
        <p className={s.empty}>Berila so ta trenutek nedosegljiva.</p>
        <div className={s.foot}>
          <a className={s.more} href={hozanaUrl(date)} target="_blank" rel="noopener noreferrer">
            Odpri na hozana.si <Arrow />
          </a>
        </div>
      </article>
    );
  }
  // "»…« (Lk 6,13)": the reference set apart from the line.
  const verse = liturgy.gospelLine?.match(/^(.*?)\s*(\([^()]+\))?$/);
  return (
    <article className={cn(s.tile, s.lit, s.reveal)} data-reveal>
      <span className={s.tag}>
        <span className={s.dot} />
        {liturgy.rank ? `${capitalise(liturgy.rank)} · danes` : "Danes"}
      </span>
      <h3>{liturgy.title}</h3>
      {liturgy.sundayName && liturgy.sundayName !== liturgy.title ? <p className={s.sundayName}>{liturgy.sundayName}</p> : null}
      {verse ? (
        <p className={s.verse}>
          {verse[1]} {verse[2] ? <span className={s.verseRef}>{verse[2].slice(1, -1)}</span> : null}
        </p>
      ) : null}
      {liturgy.readings.length ? (
        <div className={s.reads}>
          {liturgy.readings.map((r) => (
            <div key={r.label}>
              <span>{r.label}</span>
              <b>{r.ref}</b>
            </div>
          ))}
        </div>
      ) : null}
      <div className={s.foot}>
        <a className={s.btn} href={liturgy.url} target="_blank" rel="noopener noreferrer">
          Preberi današnja berila
        </a>
        <span className={s.label}>Vir: {liturgy.source === "oznanila" ? "oznanila in hozana.si" : "hozana.si"}</span>
      </div>
    </article>
  );
}

function EventTile({ date, event }: { date: IsoDate; event: PublicEvent | null }) {
  if (!event) {
    return (
      <div className={cn(s.tile, s.reveal)} data-reveal>
        <span className={s.label}>Naslednji dogodek</span>
        <p className={s.empty} style={{ marginTop: "auto" }}>
          V naslednjih tednih ni napovedanih dogodkov.
        </p>
        <Link className={s.more} href={routes.eventsArchive}>
          Pretekli dogodki <Arrow />
        </Link>
      </div>
    );
  }
  const day = dateOf(event.start);
  const until = daysUntil(day, date);
  return (
    <Link className={cn(s.tile, s.evt, s.reveal)} href={routes.event(event.slug)} data-reveal>
      <div className={s.row}>
        <span className={s.label}>Naslednji dogodek</span>
        <span className={s.label} style={{ color: "var(--accentInk)" }}>
          {formatDaysUntil(until)}
        </span>
      </div>
      <div className={s.cal} aria-hidden="true">
        <span className={s.calM}>{formatMonthShort(day)}</span>
        <span className={s.calD}>{Number(day.slice(8))}</span>
        <span className={s.calW}>{WEEKDAY_LABEL[weekdayOf(day)]}</span>
      </div>
      <h3>{event.title}</h3>
      <p className={s.meta}>
        {formatDayHeading(day)}
        {event.allDay ? "" : `, ob ${formatTime(timeOf(event.start))}`}
        {event.locationName ? ` · ${event.locationName}` : ""}
      </p>
    </Link>
  );
}

/** Slovenian plural: 1 obvestilo, 2 obvestili, 3 obvestila, 5 obvestil. */
function plural(n: number, forms: [string, string, string, string]): string {
  const r = n % 100;
  return `${n} ${r === 1 ? forms[0] : r === 2 ? forms[1] : r === 3 || r === 4 ? forms[2] : forms[3]}`;
}

function BulletinTile({ date, bulletin }: { date: IsoDate; bulletin: PublicBulletinWithEvents | null }) {
  const missing = missingBulletinNote(bulletin, date);
  const monthly = bulletin ? Date.parse(bulletin.periodEnd) - Date.parse(bulletin.periodStart) > 20 * 86_400_000 : false;
  const items = bulletin
    ? [
        bulletin.article?.title || null,
        bulletin.notices.length || bulletin.events.length
          ? [bulletin.notices.length ? plural(bulletin.notices.length, ["obvestilo", "obvestili", "obvestila", "obvestil"]) : null, bulletin.events.length ? plural(bulletin.events.length, ["srečanje", "srečanji", "srečanja", "srečanj"]) : null]
              .filter(Boolean)
              .join(" in ")
          : null,
        monthly ? "Mašni nameni za ves mesec" : "Mašni nameni za ves teden",
      ].filter((x): x is string => Boolean(x))
    : [];

  return (
    <div className={cn(s.tile, s.bul, s.reveal)} data-reveal>
      <div className={s.row}>
        <span className={s.label} style={{ color: "var(--accentInk)" }}>
          Oznanila
        </span>
        {bulletin?.issue && !missing ? <span className={s.label}>{bulletin.issue.replace(/,\s*številka\s*/i, " · št. ")}</span> : null}
      </div>
      <p className={s.big}>{missing ? missing.heading : bulletin ? bulletinLabel(bulletin) : "Oznanila"}</p>
      {missing ? (
        <p className={s.empty}>{missing.note}</p>
      ) : (
        <ul className={s.list}>
          {items.map((x) => (
            <li key={x}>{x}</li>
          ))}
        </ul>
      )}
      <div className={s.foot}>
        <Link className={s.btn} href={routes.announcements}>
          Preberi oznanila
        </Link>
        {bulletin?.pdfUrl ? (
          <a className={s.more} href={bulletin.pdfUrl} aria-label={`Prenesi PDF: ${bulletinLabel(bulletin)}`}>
            PDF ↓
          </a>
        ) : null}
      </div>
    </div>
  );
}

function WeekTile({ week }: { week: WeekAheadDay[] }) {
  return (
    <div className={cn(s.tile, s.wide, s.reveal)} data-reveal>
      <div className={s.row}>
        <span className={s.label}>Svete maše do nedelje</span>
        <Link className={s.more} href={routes.masses}>
          Ves razpored <Arrow />
        </Link>
      </div>
      {week.length ? (
        <ul className={s.days} style={{ listStyle: "none", padding: 0, margin: "auto 0 0", ["--cols" as string]: Math.min(Math.max(week.length, 4), 5) }}>
          {week.map((d) => (
            <li key={d.date} className={cn(s.day, d.sunday && s.sun)}>
              <p className={s.d}>{d.label}</p>
              <p className={s.n}>
                <time dateTime={d.date}>{d.day}</time>
              </p>
              <p className={s.tm}>
                {d.masses.map((m, n) => (
                  <span key={m.key}>
                    {n ? <br /> : null}
                    {m.cancelled ? (
                      <>
                        <s>{m.label}</s> odpade
                      </>
                    ) : (
                      `${m.label} ${m.church}`
                    )}
                  </span>
                ))}
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <p className={s.empty} style={{ marginTop: "auto" }}>
          Do nedelje ni vpisanih svetih maš.
        </p>
      )}
    </div>
  );
}
