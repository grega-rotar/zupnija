import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getChurch, getChurchesBrief, getCurrentSchedules, getSettings } from "@/sanity/data";
import { absoluteUrl, breadcrumbJsonLd, buildMetadata, type JsonLd } from "@/lib/seo";
import { routes } from "@/lib/routes";
import { clean } from "@/lib/clean";
import { cn } from "@/lib/utils";
import { CHURCH_KIND_LABEL } from "@/lib/labels";
import { urlFor } from "@/sanity/image";
import { RichText } from "@/components/sanity/RichText";
import { SanityImage, hasImage } from "@/components/sanity/SanityImage";
import { PhotoGrid } from "@/components/gallery/PhotoGrid";
import { ScheduleTable } from "@/components/masses/ScheduleTable";
import { Icon, type IconName } from "@/components/ui/Icon";
import { Breadcrumbs, Container, JsonLdScript, Section } from "@/components/ui/primitives";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const [settings, church] = await Promise.all([getSettings(), getChurch(slug, false)]);
  if (!church) return {};
  return buildMetadata({ settings, title: church.name, description: church.summary, path: routes.church(slug), seo: church.seo, image: church.image });
}

export default async function ChurchPage({ params }: Props) {
  const { slug } = await params;
  const [settings, church, churches, schedules] = await Promise.all([getSettings(), getChurch(slug), getChurchesBrief(), getCurrentSchedules()]);
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
      <Section tight className="pt-8 sm:pt-10">
        <Container>
          <Breadcrumbs className="text-ink-3" items={[{ label: "Domov", href: routes.home }, { label: "Cerkve", href: routes.churches }, { label: church.shortName }]} />

          <div className="mt-6 grid gap-8 lg:grid-cols-[16rem_minmax(0,1fr)] lg:gap-10">
            {/* Church switcher */}
            <aside>
              <Link href={routes.churches} className="inline-flex min-h-10 items-center gap-2 text-small text-ink-2 hover:text-ink">
                <Icon name="arrow-left" size={16} />
                Nazaj na cerkve
              </Link>
              <ul className="mt-3 flex gap-2 overflow-x-auto pb-1 no-scrollbar lg:flex-col lg:overflow-visible">
                {churches.map((c) => {
                  const current = c._id === church._id;
                  return (
                    <li key={c._id} className="shrink-0 lg:shrink">
                      <Link
                        href={routes.church(c.slug)}
                        aria-current={current ? "page" : undefined}
                        className={cn(
                          "flex items-center gap-3 rounded-md border p-2.5 no-underline transition-colors",
                          current ? "border-stone bg-paper-2" : "border-transparent hover:border-stone",
                        )}
                      >
                        {hasImage(c.image) ? (
                          <SanityImage image={c.image} aspect={1} sizes="3rem" maxWidth={120} decorative className="size-12 shrink-0 rounded-sm" />
                        ) : (
                          <span className="size-12 shrink-0 rounded-sm bg-paper-3" aria-hidden="true" />
                        )}
                        <span className="min-w-0">
                          <span className="block text-small font-medium leading-tight text-ink">{c.shortName}</span>
                          <span className="block text-meta text-ink-3">{c.address?.city ?? CHURCH_KIND_LABEL[clean(c.kind)]}</span>
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </aside>

            <article>
              {/* Photograph + gallery grid */}
              <div className={cn("grid gap-3", thumbs.length ? "md:grid-cols-[minmax(0,3fr)_minmax(0,1.4fr)]" : "")}>
                {hasImage(church.image) ? (
                  <SanityImage image={church.image} aspect={3 / 2} sizes="(min-width: 1024px) 40rem, 100vw" maxWidth={1600} priority className="rounded-md" />
                ) : (
                  <div className="aspect-[3/2] rounded-md bg-paper-2" aria-hidden="true" />
                )}
                {thumbs.length ? (
                  <PhotoGrid images={gallery} title={church.name} variant="thumbs" thumbs={thumbs.length} extra={extra} />
                ) : null}
              </div>

              <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:gap-12">
                <div>
                  <p className="text-small text-ink-3">{CHURCH_KIND_LABEL[clean(church.kind)] ?? "Cerkev"}</p>
                  <h1 className="mt-1 text-h1">{church.name}</h1>
                  {addr?.city ? (
                    <p className="mt-3 flex items-center gap-1.5 text-body text-ink-2">
                      <Icon name="pin" size={16} className="text-ink-3" />
                      {addr.city}
                    </p>
                  ) : null}
                  {church.summary ? <p className="lede mt-5 text-ink-2">{church.summary}</p> : null}
                  <RichText value={church.description} className="mt-6" />
                  {church.history?.length ? (
                    <details className="mt-6 rounded-md border border-stone">
                      <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between px-4 text-[0.75rem] font-semibold uppercase tracking-[0.14em] text-ink [&::-webkit-details-marker]:hidden">
                        Več o zgodovini
                        <Icon name="chevron-down" size={18} className="text-ink-3" />
                      </summary>
                      <div className="border-t border-stone px-4 py-4">
                        <RichText value={church.history} />
                      </div>
                    </details>
                  ) : null}
                </div>

                <aside className="rounded-md border border-stone bg-paper-2 p-5 sm:p-6">
                  <h2 className="text-h3">Informacije</h2>
                  <dl className="mt-4 space-y-4">
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
                    <a
                      href={mapsHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-6 inline-flex min-h-10 items-center gap-2 text-[0.75rem] font-semibold uppercase tracking-[0.14em] text-ink hover:text-moss"
                    >
                      Prikaži na zemljevidu <Icon name="arrow-right" size={14} />
                    </a>
                  ) : null}
                </aside>
              </div>
            </article>
          </div>
        </Container>
      </Section>

      {hasSchedule ? (
        <Section tight tone="paper-2" className="border-t border-stone">
          <Container>
            <div className="mb-6 flex flex-wrap items-baseline justify-between gap-4">
              <h2 className="text-h2">Svete maše v tej cerkvi</h2>
              <Link href={routes.masses} className="inline-flex min-h-10 items-center gap-2 text-[0.75rem] font-semibold uppercase tracking-[0.14em] text-ink hover:text-moss">
                Današnje maše in spremembe <Icon name="arrow-right" size={14} />
              </Link>
            </div>
            <div className="max-w-2xl space-y-10">
              {regular.map((s) => (
                <ScheduleTable key={s._id} schedule={s} churchId={church._id} showTitle={regular.length > 1} compact />
              ))}
            </div>
          </Container>
        </Section>
      ) : null}

      <JsonLdScript data={jsonLd} />
      <JsonLdScript data={breadcrumbJsonLd([{ name: "Cerkve", path: routes.churches }, { name: church.name, path: routes.church(slug) }], settings)} />
    </>
  );
}

function Info({ icon, label, children }: { icon: IconName; label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <Icon name={icon} size={18} className="mt-0.5 shrink-0 text-ink-3" />
      <div className="min-w-0">
        <dt className="text-small font-medium text-ink">{label}</dt>
        <dd className="text-small text-ink-2">{children}</dd>
      </div>
    </div>
  );
}
