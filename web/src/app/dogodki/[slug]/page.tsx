import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getEvent, getHomePage, getSettings } from "@/sanity/data";
import { absoluteUrl, breadcrumbJsonLd, buildMetadata, type JsonLd } from "@/lib/seo";
import { routes } from "@/lib/routes";
import { dateOf, formatDateSpan, formatDayHeading, formatTime, timeOf } from "@/lib/dates";
import { hrefFor, isExternalHref } from "@/lib/links";
import { clean } from "@/lib/clean";
import { EVENT_CATEGORY_LABEL } from "@/lib/labels";
import { urlFor } from "@/sanity/image";
import { Attachments, RichText } from "@/components/sanity/RichText";
import { SanityImage, hasImage } from "@/components/sanity/SanityImage";
import { GalleryCard } from "@/components/gallery/GalleryCard";
import { Icon, type IconName } from "@/components/ui/Icon";
import { Breadcrumbs, Container, JsonLdScript, Section, Tag } from "@/components/ui/primitives";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const [settings, event] = await Promise.all([getSettings(), getEvent(slug, false)]);
  if (!event) return {};
  return buildMetadata({
    settings,
    title: event.title,
    description: event.summary || formatDayHeading(dateOf(event.start), true),
    path: routes.event(slug),
    seo: event.seo,
    image: event.image,
  });
}

export default async function EventPage({ params }: Props) {
  const { slug } = await params;
  const [settings, event, home] = await Promise.all([getSettings(), getEvent(slug), getHomePage()]);
  if (!event) notFound();

  const isPast = new Date(event.end ?? event.start) < new Date();
  const startDate = dateOf(event.start);
  const endDate = event.end ? dateOf(event.end) : null;
  const multiDay = Boolean(endDate && endDate !== startDate);
  const where = event.church?.name ?? event.locationName ?? null;
  const addr = event.church?.address;
  const addressLine = [addr?.street, [addr?.postalCode, addr?.city].filter(Boolean).join(" ")].filter(Boolean).join(", ");
  const mapsHref = event.church?.location
    ? `https://www.google.com/maps/search/?api=1&query=${event.church.location.lat},${event.church.location.lng}`
    : addressLine
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addressLine)}`
      : null;
  const registrationHref = hrefFor(event.registration);
  const organizer = event.organizer?.title ?? event.organizerName ?? null;

  const jsonLd: JsonLd = {
    "@context": "https://schema.org",
    "@type": "Event",
    name: event.title,
    startDate: event.start,
    ...(event.end ? { endDate: event.end } : {}),
    eventStatus: "https://schema.org/EventScheduled",
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    url: absoluteUrl(routes.event(slug), settings),
    ...(event.summary ? { description: event.summary } : {}),
    ...(hasImage(event.image) ? { image: urlFor(event.image).width(1200).height(630).fit("crop").url() } : {}),
    ...(where ? { location: { "@type": "Place", name: where, ...(addressLine ? { address: addressLine } : {}) } } : {}),
    organizer: { "@type": "Organization", name: organizer ?? settings?.name ?? "Župnija Pirniče" },
  };

  return (
    <>
      <Section tight className="pt-8 sm:pt-10">
        <Container>
          <Breadcrumbs className="text-ink-3" items={[{ label: "Domov", href: routes.home }, { label: "Dogodki", href: routes.events }, { label: event.title }]} />

          <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-12">
            <div>
              <Link href={routes.events} className="inline-flex min-h-10 items-center gap-2 text-small text-ink-2 hover:text-ink">
                <Icon name="arrow-left" size={16} />
                Nazaj na dogodke
              </Link>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <Tag tone="moss">{EVENT_CATEGORY_LABEL[clean(event.category) ?? "other"]}</Tag>
                {isPast ? <Tag>Dogodek je minil</Tag> : null}
              </div>
              <h1 className="mt-4 text-display">{event.title}</h1>
              {event.summary ? <p className="lede mt-5 text-ink-2">{event.summary}</p> : null}

              <ul className="mt-7 space-y-3 text-body text-ink">
                <Meta icon="calendar">
                  <time dateTime={event.start}>{multiDay ? formatDateSpan(startDate, endDate!) : formatDayHeading(startDate, true)}</time>
                </Meta>
                {!event.allDay ? (
                  <Meta icon="clock">
                    {event.end && !multiDay ? `${formatTime(timeOf(event.start))}–${formatTime(timeOf(event.end))}` : `Ob ${formatTime(timeOf(event.start))}`}
                  </Meta>
                ) : null}
                {where ? (
                  <Meta icon="pin">
                    {event.church?.slug ? (
                      <Link href={routes.church(event.church.slug)} className="hover:underline">
                        {where}
                      </Link>
                    ) : (
                      where
                    )}
                    {mapsHref ? (
                      <>
                        {" · "}
                        <a href={mapsHref} target="_blank" rel="noopener noreferrer" className="text-moss underline underline-offset-4">
                          zemljevid
                        </a>
                      </>
                    ) : null}
                  </Meta>
                ) : null}
                {organizer ? (
                  <Meta icon="link">
                    {event.organizer?.slug ? (
                      <Link href={routes.group(event.organizer.slug)} className="hover:underline">
                        {organizer}
                      </Link>
                    ) : (
                      organizer
                    )}
                  </Meta>
                ) : null}
              </ul>

              {registrationHref && event.registration?.label && !isPast ? (
                <a
                  href={registrationHref}
                  target={isExternalHref(registrationHref) ? "_blank" : undefined}
                  rel={isExternalHref(registrationHref) ? "noopener noreferrer" : undefined}
                  className="mt-8 inline-flex min-h-12 items-center gap-2.5 rounded-sm bg-moss px-6 text-[0.8125rem] font-semibold uppercase tracking-[0.12em] text-paper hover:bg-moss-deep"
                >
                  {event.registration.label}
                  <Icon name={isExternalHref(registrationHref) ? "external" : "arrow-right"} size={16} />
                </a>
              ) : null}
            </div>

            <div className="grid gap-5 md:grid-cols-[minmax(0,3fr)_minmax(0,1fr)]">
              {hasImage(event.image) ? (
                <SanityImage image={event.image} aspect={4 / 3} sizes="(min-width: 1024px) 40rem, 100vw" maxWidth={1400} priority className="rounded-md" />
              ) : (
                <div className="aspect-[4/3] rounded-md bg-paper-2" aria-hidden="true" />
              )}
              {home?.tile?.text ? (
                <figure className="flex flex-col items-center justify-center rounded-md border border-stone bg-paper-2 p-6 text-center">
                  <Icon name="cross" size={28} className="text-moss" />
                  <blockquote className="lede mt-4 text-ink">{home.tile.text}</blockquote>
                  {home.tile.source ? <figcaption className="mt-2 text-small text-ink-3">{home.tile.source}</figcaption> : null}
                </figure>
              ) : null}
            </div>
          </div>
        </Container>
      </Section>

      <Section tight className="border-t border-stone">
        <Container className="grid gap-10 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:gap-16">
          <div>
            <h2 className="mb-4 text-h3">Opis</h2>
            {event.description?.length ? <RichText value={event.description} size="lg" /> : <p className="text-body text-ink-2">Podrobnosti bodo objavljene.</p>}
            <Attachments items={event.attachments} />
          </div>
          <aside className="space-y-6">
            <div className="rounded-md border border-stone bg-paper-2 p-6">
              <h2 className="text-h3">Praktične informacije</h2>
              <dl className="mt-4 space-y-3 text-body">
                <div>
                  <dt className="text-small text-ink-3">Kdaj</dt>
                  <dd className="text-ink">
                    {multiDay ? formatDateSpan(startDate, endDate!) : formatDayHeading(startDate, true)}
                    {!event.allDay ? `, ${formatTime(timeOf(event.start))}` : ""}
                  </dd>
                </div>
                {where ? (
                  <div>
                    <dt className="text-small text-ink-3">Kje</dt>
                    <dd className="text-ink">
                      {where}
                      {addressLine ? <span className="block text-small text-ink-2">{addressLine}</span> : null}
                    </dd>
                  </div>
                ) : null}
                {organizer ? (
                  <div>
                    <dt className="text-small text-ink-3">Organizira</dt>
                    <dd className="text-ink">{organizer}</dd>
                  </div>
                ) : null}
              </dl>
            </div>
            {event.galleries?.length ? (
              <div>
                <h2 className="mb-4 text-h3">Fotografije</h2>
                <div className="grid grid-cols-2 gap-4">
                  {event.galleries.map((g) => (
                    <GalleryCard key={g._id} gallery={g} />
                  ))}
                </div>
              </div>
            ) : null}
          </aside>
        </Container>
      </Section>

      <JsonLdScript data={jsonLd} />
      <JsonLdScript data={breadcrumbJsonLd([{ name: "Dogodki", path: routes.events }, { name: event.title, path: routes.event(slug) }], settings)} />
    </>
  );
}

function Meta({ icon, children }: { icon: IconName; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3">
      <Icon name={icon} size={20} className="mt-0.5 shrink-0 text-ink-3" />
      <span className="min-w-0">{children}</span>
    </li>
  );
}
