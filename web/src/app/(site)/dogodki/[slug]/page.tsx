import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { getHomePage, getSettings } from "@/sanity/data";
import { getEvent } from "@/lib/data/events";
import { absoluteUrl, breadcrumbJsonLd, buildMetadata, type JsonLd } from "@/lib/seo";
import { routes } from "@/lib/routes";
import { dateOf, formatDateSpan, formatDayHeading, formatTime, timeOf } from "@/lib/dates";
import { clean } from "@/lib/clean";
import { EVENT_CATEGORY_LABEL } from "@/lib/labels";
import { RichText } from "@/components/sanity/RichText";
import { DateLeaf } from "@/components/events/EventCard";
import { Icon, type IconName } from "@/components/ui/Icon";
import { Breadcrumbs, Container, JsonLdScript, Section, Tag, TextLink, headline, tile } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";
import { eventIcsPath, eventToCal } from "@/lib/calendar/feed";
import { AddToCalendar } from "@/components/share/AddToCalendar";
import { Share } from "@/components/share/Share";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const [settings, event] = await Promise.all([getSettings(), getEvent(slug)]);
  if (!event) return {};
  return buildMetadata({
    settings,
    title: event.title,
    description: event.summary || formatDayHeading(dateOf(event.start), true),
    path: routes.event(event.slug),
  });
}

export default async function EventPage({ params }: Props) {
  const { slug } = await params;
  const [settings, event, home] = await Promise.all([getSettings(), getEvent(slug), getHomePage()]);
  if (!event) notFound();
  if (slug !== event.slug) permanentRedirect(routes.event(event.slug));

  const isPast = new Date(event.end ?? event.start) < new Date();
  const startDate = dateOf(event.start);
  const endDate = event.end ? dateOf(event.end) : null;
  const multiDay = Boolean(endDate && endDate !== startDate);
  const where = event.locationName;

  const jsonLd: JsonLd = {
    "@context": "https://schema.org",
    "@type": "Event",
    name: event.title,
    startDate: event.start,
    ...(event.end ? { endDate: event.end } : {}),
    eventStatus: "https://schema.org/EventScheduled",
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    url: absoluteUrl(routes.event(event.slug), settings),
    ...(event.summary ? { description: event.summary } : {}),
    ...(where ? { location: { "@type": "Place", name: where } } : {}),
    organizer: { "@type": "Organization", name: settings?.name ?? "Župnija Pirniče" },
  };

  return (
    <>
      <header className="pb-2 pt-10 sm:pt-14 lg:pt-20">
        <Container className="flex flex-col items-center text-center">
          <Breadcrumbs
            className="mb-6 text-ink-3 [&_[aria-current]]:text-gold-ink"
            items={[{ label: "Domov", href: routes.home }, { label: "Dogodki", href: routes.events }, { label: event.title }]}
          />
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Tag tone="gold">{EVENT_CATEGORY_LABEL[clean(event.category) ?? "other"]}</Tag>
            {isPast ? <Tag>Dogodek je minil</Tag> : null}
          </div>
          <h1 className={cn("mt-5 max-w-5xl", headline.display)}>{event.title}</h1>
          <ul className="mt-8 flex flex-wrap justify-center gap-2 text-[0.9375rem] font-semibold text-ink">
            <Meta icon="calendar">
              <time dateTime={event.start}>{multiDay ? formatDateSpan(startDate, endDate!) : formatDayHeading(startDate, true)}</time>
            </Meta>
            {!event.allDay ? (
              <Meta icon="clock">
                {event.end && !multiDay ? `${formatTime(timeOf(event.start))}–${formatTime(timeOf(event.end))}` : `Ob ${formatTime(timeOf(event.start))}`}
              </Meta>
            ) : null}
            {where ? <Meta icon="pin">{where}</Meta> : null}
          </ul>
        </Container>
      </header>

      <Section>
        <Container className="grid gap-5 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
          <div className={cn(tile, "self-start p-6 sm:p-10")}>
            <p className="eyebrow">Opis</p>
            <div className="mt-4">
              {event.description?.length ? <RichText value={event.description} size="lg" /> : <p className="text-body text-ink-2">Podrobnosti bodo objavljene.</p>}
            </div>
          </div>
          <aside className="space-y-5 self-start">
            <div className={cn(tile, "p-6 sm:p-8")}>
              <div className="flex items-center gap-5">
                <DateLeaf start={event.start} end={event.end} />
                <h2 className="text-[1.5rem] font-bold leading-tight tracking-[-0.035em]">Praktične informacije</h2>
              </div>
              <dl className="mt-6 space-y-4 border-t border-stone/70 pt-5 text-body">
                <div>
                  <dt className="text-small font-semibold text-ink-3">Kdaj</dt>
                  <dd className="text-ink">
                    {multiDay ? formatDateSpan(startDate, endDate!) : formatDayHeading(startDate, true)}
                    {!event.allDay ? `, ${formatTime(timeOf(event.start))}` : ""}
                  </dd>
                </div>
                {where ? (
                  <div>
                    <dt className="text-small font-semibold text-ink-3">Kje</dt>
                    <dd className="text-ink">{where}</dd>
                  </div>
                ) : null}
              </dl>
              {!isPast ? <AddToCalendar event={eventToCal(event, settings)} icsHref={eventIcsPath(event.slug)} className="mt-5 border-t border-stone/70 pt-5" /> : null}
              <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                <Share title={event.title} url={absoluteUrl(routes.event(event.slug), settings)} />
                <TextLink href={routes.events}>Vsi dogodki</TextLink>
              </div>
            </div>
            {home?.tile?.text ? (
              <figure className="rounded-lg bg-[linear-gradient(165deg,var(--color-gold-soft)_0%,#fff_72%)] p-8 text-center shadow-soft">
                <blockquote className="font-serif text-[1.5rem] italic leading-snug text-ink">{home.tile.text}</blockquote>
                {home.tile.source ? <figcaption className="eyebrow mt-3">{home.tile.source}</figcaption> : null}
              </figure>
            ) : null}
          </aside>
        </Container>
      </Section>

      <JsonLdScript data={jsonLd} />
      <JsonLdScript data={breadcrumbJsonLd([{ name: "Dogodki", path: routes.events }, { name: event.title, path: routes.event(event.slug) }], settings)} />
    </>
  );
}

function Meta({ icon, children }: { icon: IconName; children: React.ReactNode }) {
  return (
    <li className="inline-flex min-h-11 items-center gap-2 rounded-full bg-surface px-5 shadow-soft">
      <Icon name={icon} size={17} className="shrink-0 text-gold-ink" />
      <span className="min-w-0">{children}</span>
    </li>
  );
}
