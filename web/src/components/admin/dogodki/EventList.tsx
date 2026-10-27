import Link from "next/link";
import { Icon } from "@/components/admin/Icon";
import { formatDayNumber, formatTime, formatWeekdayShort } from "@/lib/dates";
import type { EventItem, EventMonth } from "@/lib/dogodki/queries";
import s from "./dogodki.module.css";

/** "Marta Zupan" → "Marta" (the prototype's first()). */
const firstOf = (name: string) => {
  const w = name.trim().split(/\s+/);
  return w.length > 1 ? w[w.length - 2] : w[0];
};

/** Panel link for a row: the event id, or the proposal ("cr7") for a new event that waits for the owner. */
const eventParam = (e: EventItem) => (e.id != null ? String(e.id) : e.key);

/** The prototype's vEvents() list: month headings, date boxes, pills. */
export function EventList({ months, me }: { months: EventMonth[]; me: string }) {
  if (!months.length)
    return (
      <div className="calm">
        <h3>Ni prihodnjih dogodkov.</h3>
        <p>Dodajte srečanje, molitev ali delovno akcijo. Pokaže se na strani Dogodki.</p>
        <Link href="/dogodki?dogodek=nov" className={`btn primary ${s.link} ${s.calmAct}`} scroll={false} prefetch={false}>
          <Icon name="plus" />
          Nov dogodek
        </Link>
      </div>
    );
  return (
    <div className="evlist">
      {months.map((m) => [
        <p key={m.key} className="month">
          {m.month}
        </p>,
        ...m.items.map((e) => (
          <Link key={e.key} href={`/dogodki?dogodek=${eventParam(e)}`} scroll={false} prefetch={false} className={`ev ${s.link}`}>
            <span className="datebox">
              <b>{formatDayNumber(e.date)}</b>
              <span>{formatWeekdayShort(e.date)}</span>
            </span>
            <span>
              <h3>{e.title}</h3>
              <p>
                <span>{formatTime(e.time)}</span>
                <span>· {e.place}</span>
                {e.onFrontPage ? <span className="pill">na prvi strani</span> : null}
                {e.pending ? (
                  <span className="pill gold">{e.pending.by === me ? "čaka župnika" : `čaka potrditev · ${firstOf(e.pending.byName)}`}</span>
                ) : null}
              </p>
            </span>
            <span className="chev">
              <Icon name="r" />
            </span>
          </Link>
        )),
      ])}
    </div>
  );
}
