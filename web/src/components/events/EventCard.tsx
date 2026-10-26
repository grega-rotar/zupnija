import Link from "next/link";
import type { UPCOMING_EVENTS_QUERY_RESULT } from "@/sanity/types.generated";
import { dateOf, formatDayNumber, formatMonthShort, formatTime, formatWeekdayShort, timeOf, formatDateSpan } from "@/lib/dates";
import { EVENT_CATEGORY_LABEL } from "@/lib/labels";
import { clean } from "@/lib/clean";
import { routes } from "@/lib/routes";
import { cn } from "@/lib/utils";
import { SanityImage, hasImage } from "@/components/sanity/SanityImage";
import { EmptyState } from "@/components/ui/primitives";

export type EventCardData = UPCOMING_EVENTS_QUERY_RESULT[number];

/** Calendar leaf: weekday, big day number, month. Reads at a glance on phones. */
export function DateLeaf({ start, end, className }: { start: string; end?: string | null; className?: string }) {
  const startDate = dateOf(start);
  const endDate = end ? dateOf(end) : null;
  const multiDay = endDate && endDate !== startDate;
  return (
    <div className={cn("flex w-14 shrink-0 flex-col items-center py-1 text-center leading-none", className)}>
      <span className="text-meta uppercase tracking-wider text-ink-3">{formatWeekdayShort(startDate)}</span>
      <span className="mt-1 font-serif text-[2rem] leading-none text-ink">{formatDayNumber(startDate)}</span>
      <span className="text-meta text-ink-2">{multiDay ? `– ${formatDayNumber(endDate)}. ${formatMonthShort(endDate)}` : formatMonthShort(startDate)}</span>
    </div>
  );
}

function whenLine(event: EventCardData): string {
  const startDate = dateOf(event.start);
  const endDate = event.end ? dateOf(event.end) : null;
  if (endDate && endDate !== startDate) return formatDateSpan(startDate, endDate);
  if (event.allDay) return "Ves dan";
  const t = formatTime(timeOf(event.start));
  return event.end ? `${t}–${formatTime(timeOf(event.end))}` : `ob ${t}`;
}

function whereLine(event: EventCardData): string | null {
  return event.church?.shortName ?? event.locationName ?? null;
}

/** Row-style card for lists. Image optional; layout holds without it. */
export function EventRow({ event }: { event: EventCardData }) {
  const where = whereLine(event);
  return (
    <li>
      <Link
        href={routes.event(event.slug)}
        className="group grid grid-cols-[3.5rem_1fr] gap-5 py-6 no-underline sm:grid-cols-[3.5rem_1fr_auto] sm:items-center sm:gap-6"
      >
        <DateLeaf start={event.start} end={event.end} />
        <div className="min-w-0">
          <p className="text-meta text-ink-3">{EVENT_CATEGORY_LABEL[clean(event.category) ?? "other"]}</p>
          <h3 className="mt-0.5 font-serif text-h3 text-ink group-hover:underline">{event.title}</h3>
          <p className="mt-1 text-small text-ink-2">
            <span className="tnum">{whenLine(event)}</span>
            {where ? <span> · {where}</span> : null}
          </p>
          {event.summary ? <p className="mt-1.5 hidden text-small text-ink-2 sm:block">{event.summary}</p> : null}
        </div>
        {hasImage(event.image) ? (
          <SanityImage image={event.image} aspect={4 / 3} sizes="9rem" maxWidth={360} decorative className="hidden w-36 rounded-md sm:block" />
        ) : null}
      </Link>
    </li>
  );
}

/** Card with image for grids. Without an image the leaf sits on a quiet placeholder. */
export function EventCard({ event, priority }: { event: EventCardData; priority?: boolean }) {
  const where = whereLine(event);
  return (
    <article className="group">
      <Link href={routes.event(event.slug)} className="block no-underline">
        {hasImage(event.image) ? (
          <SanityImage image={event.image} aspect={4 / 3} sizes="(min-width: 1024px) 24rem, (min-width: 640px) 50vw, 100vw" maxWidth={900} priority={priority} decorative className="rounded-sm" imgClassName="transition-transform duration-700 ease-out-soft group-hover:scale-[1.02] motion-reduce:transform-none" />
        ) : (
          <div className="aspect-[4/3] rounded-sm bg-paper-2" aria-hidden="true" />
        )}
        <div className="mt-5 flex items-start gap-4 border-t border-stone pt-4">
          <DateLeaf start={event.start} end={event.end} />
          <div className="min-w-0">
            <p className="text-meta text-ink-3">{EVENT_CATEGORY_LABEL[clean(event.category) ?? "other"]}</p>
            <h3 className="mt-0.5 font-serif text-h3 text-ink group-hover:underline">{event.title}</h3>
            <p className="mt-1 text-small text-ink-2">
              <span className="tnum">{whenLine(event)}</span>
              {where ? <span> · {where}</span> : null}
            </p>
          </div>
        </div>
      </Link>
    </article>
  );
}

export function EventList({ events, emptyText = "Trenutno ni napovedanih dogodkov." }: { events: EventCardData[]; emptyText?: string }) {
  if (!events.length) return <EmptyState title="Ni dogodkov" text={emptyText} />;
  return <ul className="divide-y divide-stone border-y border-stone">{events.map((e) => <EventRow key={e._id} event={e} />)}</ul>;
}
