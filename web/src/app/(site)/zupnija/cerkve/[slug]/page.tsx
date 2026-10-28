import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getChurch, getChurchesBrief, getCurrentSchedules, getSettings } from "@/sanity/data";
import { getChurchMasses } from "@/lib/data/masses";
import { absoluteUrl, breadcrumbJsonLd, buildMetadata, type JsonLd } from "@/lib/seo";
import { routes } from "@/lib/routes";
import { clean } from "@/lib/clean";
import { cn } from "@/lib/utils";
import { CHURCH_KIND_LABEL } from "@/lib/labels";
import { urlFor } from "@/sanity/image";
import { RichText } from "@/components/sanity/RichText";
import { SanityImage, hasImage, ImagePlaceholder } from "@/components/sanity/SanityImage";
import { PhotoGrid } from "@/components/gallery/PhotoGrid";
import { ScheduleTable } from "@/components/masses/ScheduleTable";
import { Icon, type IconName } from "@/components/ui/Icon";
import { Breadcrumbs, Container, JsonLdScript, Section, SectionHeading, TextLink, headline, tile } from "@/components/ui/primitives";
import { DayLeaf, MassRow, dayLines } from "@/components/masses/MassList";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const [settings, church] = await Promise.all([getSettings(), getChurch(slug, false)]);
  if (!church) return {};
  return buildMetadata({ settings, title: church.name, description: church.summary, path: routes.church(slug), seo: church.seo, image: church.image });
}

export default async function ChurchPage({ params }: Props) {
  const { slug } = await params;
  const [settings, church, churches, schedules, upcoming] = await Promise.all([
    getSettings(),
    getChurch(slug),
    getChurchesBrief(),
    getCurrentSchedules(),
    getChurchMasses(slug, 14),
  ]);
  if (!church) notFound();

  const regular = schedules.filter((s) => !s.validFrom && !s.validUntil);
  const hasSchedule = regular.some((s) => s.entries?.some((e) => e.church?._id === church._id));
  const addr = church.address;
  const addressLine = [addr?.street, [addr?.postalCode, addr?.city].filter(Boolean).join(" ")].filter(Boolean).join(", ");
  const mapsHref = church.location
    ? `https://www.google.com/maps/search/?api=1&query=${church.location.lat},${church.location.lng}`
    : addressLine
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addressLine)}`
      : null;
  const gallery = church.gallery ?? [];
  const thumbs = gallery.slice(0, 3);
  const extra = gallery.length - thumbs.length;

  const jsonLd: JsonLd = {
    "@context": "https://schema.org",
    "@type": "Church",
    name: church.name,
    url: absoluteUrl(routes.church(slug), settings),
    ...(church.summary ? { description: church.summary } : {}),
    ...(hasImage(church.image) ? { image: urlFor(church.image).width(1200).height(630).fit("crop").url() } : {}),
    ...(addressLine
      ? { address: { "@type": "PostalAddress", streetAddress: addr?.street ?? undefined, postalCode: addr?.postalCode ?? undefined, addressLocality: addr?.city ?? undefined, addressCountry: "SI" } }
      : {}),
    ...(church.location ? { geo: { "@type": "GeoCoordinates", latitude: church.location.lat, longitude: church.location.lng } } : {}),
    ...(settings?.name ? { parentOrganization: { "@type": "Organization", name: settings.name } } : {}),
  };

  return (
    <>
      <header className="pb-2 pt-10 sm:pt-14 lg:pt-20">
        <Container className="flex flex-col items-center text-center">
          <Breadcrumbs
            className="mb-6 text-ink-3 [&_[aria-current]]:text-gold-ink"
            items={[{ label: "Domov", href: routes.home }, { label: "Cerkve", href: routes.churches }, { label: church.shortName }]}
          />
          <p className="eyebrow">{CHURCH_KIND_LABEL[clean(church.kind)] ?? "Cerkev"}</p>
          <h1 className={cn("mt-3 max-w-5xl", headline.display)}>{church.shortName || church.name}</h1>
          {church.shortName && church.shortName !== church.name ? <p className="lede mx-auto mt-5 max-w-[40rem] text-balance">{church.name}</p> : null}

          {/* Church switcher */}
          <nav aria-label="Cerkve" className="mt-8 flex flex-wrap justify-center gap-2">
            {churches.map((c) => {
              const current = c._id === church._id;
              return (
                <Link
                  key={c._id}
                  href={routes.church(c.slug)}
                  aria-current={current ? "page" : undefined}
                  className={cn(
                    "inline-flex min-h-11 items-center rounded-full px-4 text-[0.9375rem] font-semibold no-underline transition-colors sm:px-5",
                    current ? "bg-moss text-paper" : "bg-surface text-ink shadow-soft hover:bg-paper-2",
                  )}
                >
                  {c.shortName}
                </Link>
              );
            })}
          </nav>
        </Container>
      </header>

      <Section>
        <Container>
          {/* Photograph + gallery */}
          <div className="grid gap-4">
            <div className="overflow-hidden rounded-[2rem] shadow-soft sm:rounded-xl [&>*]:max-sm:aspect-[4/3]!">
              {hasImage(church.image) ? (
                <SanityImage
                  image={church.image}
                  aspect={21 / 9}
                  sizes="(min-width: 1280px) 77rem, 100vw"
                  maxWidth={1800}
                  priority
                  imgClassName="[filter:saturate(.55)_sepia(.12)]"
                />
              ) : (
                <ImagePlaceholder className="aspect-[4/3] sm:aspect-[21/9]" />
              )}
            </div>
            {thumbs.length ? (
              <div>
                <PhotoGrid images={gallery} title={church.name} variant="thumbs" thumbs={thumbs.length} extra={extra} />
              </div>
            ) : null}
          </div>

          <div className="mt-14 grid gap-10 lg:mt-20 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:gap-16">
            <div className="min-w-0">
              {church.summary ? <p className="text-[clamp(1.375rem,1.2rem+0.8vw,1.875rem)] font-semibold leading-snug tracking-[-0.03em] text-ink">{church.summary}</p> : null}
              {addr?.city ? (
                <p className="mt-3 flex items-center gap-1.5 text-body text-ink-2">
                  <Icon name="pin" size={16} className="text-gold-ink" />
                  {addr.city}
                </p>
              ) : null}
              <RichText value={church.description} className="mt-6" />
              {church.history?.length ? (
                <details className={cn(tile, "group/d mt-8 overflow-hidden")}>
                  <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between rounded-lg px-6 text-body font-semibold text-ink [&::-webkit-details-marker]:hidden">
                    Več o zgodovini
                    <Icon name="chevron-down" size={18} className="text-gold-ink transition-transform duration-300 group-open/d:rotate-180" />
                  </summary>
                  <div className="border-t border-stone/70 px-6 py-5">
                    <RichText value={church.history} />
                  </div>
                </details>
              ) : null}
            </div>

            <aside className={cn(tile, "self-start p-6 sm:p-8")}>
              <p className="eyebrow">Za obisk</p>
              <h2 className="mt-2 text-[1.75rem] font-bold tracking-[-0.04em]">Informacije</h2>
              <dl className="mt-5 space-y-5">
                {addressLine ? (
                  <Info icon="pin" label="Naslov">
                    {addressLine}
                  </Info>
                ) : null}
                {church.dedication ? (
                  <Info icon="cross" label="Ime zavetnice / zavetnika">
                    {church.dedication}
                  </Info>
                ) : null}
                {church.patronFeast ? (
                  <Info icon="calendar" label="Žegnanje">
                    {church.patronFeast}
                  </Info>
                ) : null}
                {church.parking?.length ? (
                  <Info icon="pin" label="Parkiranje">
                    <RichText value={church.parking} size="sm" />
                  </Info>
                ) : null}
                {church.accessibility?.length ? (
                  <Info icon="check" label="Dostopnost">
                    <RichText value={church.accessibility} size="sm" />
                  </Info>
                ) : null}
                {church.visitNotes?.length ? (
                  <Info icon="clock" label="Za obiskovalce">
                    <RichText value={church.visitNotes} size="sm" />
                  </Info>
                ) : null}
              </dl>
              {mapsHref ? (
                <TextLink href={mapsHref} external className="mt-4">
                  Prikaži na zemljevidu
                </TextLink>
              ) : null}
            </aside>
          </div>
        </Container>
      </Section>

      <Section aria-labelledby="mase-v-cerkvi">
        <Container>
          <SectionHeading
            id="mase-v-cerkvi"
            eyebrow="Bogoslužje"
            title="Svete maše v tej cerkvi"
            accent="v tej cerkvi"
            lede="Maše in nameni v naslednjih dveh tednih."
          />
          <div className={cn("grid gap-5", hasSchedule && "lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]")}>
            {upcoming.length ? (
              <ol className={cn(tile, "divide-y divide-stone/70 self-start px-6 sm:px-8")}>
                {upcoming.map((day) => (
                  <li key={day.date} className="flex gap-5 py-6">
                    <DayLeaf date={day.date} />
                    <div className="min-w-0 flex-1">
                      {dayLines(day).title ? <p className="text-small font-medium text-ink-3">{dayLines(day).title}</p> : null}
                      <ul className="divide-y divide-stone/70 [&>li:first-child]:pt-1 [&>li:last-child]:pb-0">
                        {day.masses.map((m) => (
                          <MassRow key={m.key} mass={m} showIntentions hideChurch />
                        ))}
                      </ul>
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <div className={cn(tile, "self-start px-6 py-14 text-center")}>
                <p className="text-body text-ink-2">V naslednjih dveh tednih tu ni svetih maš.</p>
                <TextLink href={routes.masses} className="mt-2">
                  Vse svete maše
                </TextLink>
              </div>
            )}
            {hasSchedule ? (
              <div className="space-y-5 self-start">
                {regular.map((s) => (
                  <div key={s._id} className={cn(tile, "p-6 sm:p-8")}>
                    <p className="eyebrow">Redni urnik</p>
                    <ScheduleTable schedule={s} churchId={church._id} showTitle={regular.length > 1} compact />
                  </div>
                ))}
                <TextLink href={routes.masses} className="px-2">
                  Današnje maše in spremembe
                </TextLink>
              </div>
            ) : null}
          </div>
        </Container>
      </Section>

      <JsonLdScript data={jsonLd} />
      <JsonLdScript data={breadcrumbJsonLd([{ name: "Cerkve", path: routes.churches }, { name: church.name, path: routes.church(slug) }], settings)} />
    </>
  );
}

function Info({ icon, label, children }: { icon: IconName; label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <Icon name={icon} size={18} className="mt-0.5 shrink-0 text-gold-ink" />
      <div className="min-w-0">
        <dt className="text-small font-semibold text-ink">{label}</dt>
        <dd className="text-small text-ink-2">{children}</dd>
      </div>
    </div>
  );
}
