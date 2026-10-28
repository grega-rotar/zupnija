import Link from "next/link";
import type { UPCOMING_EVENTS_QUERY_RESULT } from "@/sanity/types.generated";
import { dateOf, formatDayNumber, formatMonthShort, formatTime, formatWeekdayShort, timeOf, formatDateSpan } from "@/lib/dates";
import { EVENT_CATEGORY_LABEL } from "@/lib/labels";
import { clean } from "@/lib/clean";
import { routes } from "@/lib/routes";
import { cn } from "@/lib/utils";
import { SanityImage, hasImage, ImagePlaceholder } from "@/components/sanity/SanityImage";
import { EmptyState, tile, tileHover } from "@/components/ui/primitives";

export type EventCardData = UPCOMING_EVENTS_QUERY_RESULT[number];

/** Calendar page: the month on a gold-brown band, the big day number, the weekday (or the last day). */
export function DateLeaf({ start, end, className }: { start: string; end?: string | null; className?: string }) {
  const startDate = dateOf(start);
  const endDate = end ? dateOf(end) : null;
  const multiDay = endDate && endDate !== startDate;
  return (
    <div className={cn("flex w-16 shrink-0 flex-col overflow-hidden rounded-[1rem] bg-surface text-center leading-none shadow-soft", className)}>
      <span className="bg-moss py-[3px] text-[0.625rem] font-bold uppercase tracking-[0.08em] text-paper">{formatMonthShort(startDate)}</span>
      <span className="pt-1.5 text-[1.75rem] font-bold tabular-nums tracking-[-0.05em] text-ink">{formatDayNumber(startDate)}</span>
      <span className="pb-2 pt-0.5 text-[0.6875rem] font-medium text-ink-3">
        {multiDay ? `– ${formatDayNumber(endDate)}. ${formatMonthShort(endDate)}` : formatWeekdayShort(startDate)}
      </span>
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

/** One event as a row inside a tile list (`EventList`). Image optional; layout holds without it. */
export function EventRow({ event }: { event: EventCardData }) {
  const where = whereLine(event);
  return (
    <li>
      <Link
        href={routes.event(event.slug)}
        className="group grid grid-cols-[4rem_1fr] gap-5 px-6 py-6 no-underline transition-colors hover:bg-paper sm:grid-cols-[4rem_1fr_auto] sm:items-center sm:gap-6 sm:px-8"
      >
        <DateLeaf start={event.start} end={event.end} />
        <div className="min-w-0">
          <p className="eyebrow">{EVENT_CATEGORY_LABEL[clean(event.category) ?? "other"]}</p>
          <h3 className="mt-1 text-[1.25rem] font-bold leading-snug tracking-[-0.03em] text-ink">{event.title}</h3>
          <p className="mt-1 text-small text-ink-2">
            <span className="tnum">{whenLine(event)}</span>
            {where ? <span> · {where}</span> : null}
          </p>
          {event.summary ? <p className="mt-1.5 hidden text-small text-ink-3 sm:block">{event.summary}</p> : null}
        </div>
        {hasImage(event.image) ? (
          <SanityImage image={event.image} aspect={4 / 3} sizes="9rem" maxWidth={360} decorative className="hidden w-36 overflow-hidden rounded-md sm:block" imgClassName="saturate-[.7]" />
        ) : null}
      </Link>
    </li>
  );
}

/** Tile with photo for grids. Without an image the leaf sits on a quiet placeholder. */
export function EventCard({ event, priority }: { event: EventCardData; priority?: boolean }) {
  const where = whereLine(event);
  return (
    <Link href={routes.event(event.slug)} className={cn(tile, tileHover, "group flex flex-col overflow-hidden no-underline")}>
      <div className="overflow-hidden bg-paper-2">
        {hasImage(event.image) ? (
          <SanityImage
            image={event.image}
            aspect={4 / 3}
            sizes="(min-width: 1024px) 24rem, (min-width: 640px) 50vw, 100vw"
            maxWidth={900}
            priority={priority}
            decorative
            imgClassName="saturate-[.7] transition-transform duration-[800ms] ease-out-soft group-hover:scale-[1.03] motion-reduce:transform-none"
          />
        ) : (
          <ImagePlaceholder className="aspect-[4/3]" />
        )}
      </div>
      <div className="flex items-start gap-4 px-7 pb-7 pt-6">
        <DateLeaf start={event.start} end={event.end} />
        <div className="min-w-0">
          <p className="eyebrow">{EVENT_CATEGORY_LABEL[clean(event.category) ?? "other"]}</p>
          <h3 className="mt-1 text-[1.25rem] font-bold leading-snug tracking-[-0.03em] text-ink">{event.title}</h3>
          <p className="mt-1 text-small text-ink-2">
            <span className="tnum">{whenLine(event)}</span>
            {where ? <span> · {where}</span> : null}
          </p>
        </div>
      </div>
    </Link>
  );
}

/** Events as rows in one white tile. */
export function EventList({ events, emptyText = "Trenutno ni napovedanih dogodkov." }: { events: EventCardData[]; emptyText?: string }) {
  if (!events.length) return <EmptyState title="Ni dogodkov" text={emptyText} />;
  return (
    <ul className={cn(tile, "divide-y divide-stone/70 overflow-hidden")}>
      {events.map((e) => (
        <EventRow key={e._id} event={e} />
      ))}
    </ul>
  );
}
