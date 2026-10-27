import { EventList } from "@/components/admin/dogodki/EventList";
import { EventPanel, type EventPanelProps } from "@/components/admin/dogodki/EventPanel";
import Link from "next/link";
import { Icon } from "@/components/admin/Icon";
import { PageHead } from "@/components/admin/ui";
import s from "@/components/admin/dogodki/dogodki.module.css";
import { requirePageArea } from "@/lib/admin/next";
import { needsApproval, type Actor } from "@/lib/admin/sections";
import { today, weekStart } from "@/lib/clock";
import { addDays } from "@/lib/dates";
import { PLACES } from "@/lib/dogodki/places";
import { getEvent, groupByMonth, listEvents, type EventItem } from "@/lib/dogodki/queries";

type Search = { dogodek?: string | string[]; naslov?: string | string[] };
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

const draftOf = (e: EventItem) => ({
  id: e.id,
  title: e.title,
  date: e.date,
  time: e.time,
  place: e.place,
  description: e.description,
  onFrontPage: e.onFrontPage,
});
const pendingOf = (e: EventItem) => (e.pending ? { changeRequestId: e.pending.changeRequestId, byName: e.pending.byName } : null);

/** The panel the URL asks for: ?dogodek=nov, ?dogodek=<id>, or ?dogodek=cr<id> (a proposed new event). */
async function panelFor(param: string | undefined, title: string | undefined, events: EventItem[], actor: Actor): Promise<EventPanelProps | null> {
  const who = { isOwner: actor.isOwner, approval: needsApproval(actor) };
  if (param === "nov") {
    // The prototype's default: Sunday of next week.
    const date = addDays(weekStart(today()), 13);
    return { ...who, pending: null, draft: { id: null, title: title?.trim() ?? "", date, time: "", place: PLACES[0], description: "", onFrontPage: false } };
  }
  if (param && /^cr\d+$/.test(param)) {
    const e = events.find((x) => x.key === param);
    return e ? { ...who, draft: draftOf(e), pending: pendingOf(e) } : null;
  }
  if (param && /^\d+$/.test(param)) {
    const e = await getEvent(Number(param));
    if (!e) return null;
    const shown = e.proposed ?? e;
    return { ...who, draft: draftOf(shown), pending: pendingOf(shown) };
  }
  return null;
}

export default async function DogodkiPage({ searchParams }: { searchParams: Promise<Search> }) {
  const actor = await requirePageArea("dogodki");
  const sp = await searchParams;
  const events = await listEvents();
  const param = one(sp.dogodek);
  const panel = await panelFor(param, one(sp.naslov), events, actor);

  return (
    <div className="page enter">
      <PageHead
        title="Dogodki"
        sub="Kar ni maša: srečanja, molitve, delovne akcije."
        action={
          <Link href="/dogodki?dogodek=nov" className={`btn primary ${s.link}`} scroll={false} prefetch={false}>
            <Icon name="plus" />
            Nov dogodek
          </Link>
        }
      />
      <EventList months={groupByMonth(events)} me={actor.id} />
      {panel ? <EventPanel key={param} {...panel} /> : null}
    </div>
  );
}
