import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getGroup, getSettings } from "@/sanity/data";
import { breadcrumbJsonLd, buildMetadata } from "@/lib/seo";
import { routes } from "@/lib/routes";
import { hrefFor, isExternalHref, telHref } from "@/lib/links";
import { RichText } from "@/components/sanity/RichText";
import { SanityImage, hasImage } from "@/components/sanity/SanityImage";
import { PhotoGrid } from "@/components/gallery/PhotoGrid";
import { EventList } from "@/components/events/EventCard";
import { PersonCard } from "@/components/sections/PageSections";
import { Breadcrumbs, Container, JsonLdScript, MetaRow, PageHeader, Section, SectionHeading, TextLink } from "@/components/ui/primitives";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const [settings, group] = await Promise.all([getSettings(), getGroup(slug, false)]);
  if (!group) return {};
  return buildMetadata({ settings, title: group.title, description: group.summary, path: routes.group(slug), seo: group.seo, image: group.image });
}

export default async function GroupPage({ params }: Props) {
  const { slug } = await params;
  const [settings, group] = await Promise.all([getSettings(), getGroup(slug)]);
  if (!group) notFound();

  const links = (group.links ?? [])
    .map((l) => ({ key: l._key, label: l.label, href: hrefFor(l) }))
    .filter((l): l is { key: string; label: string; href: string } => Boolean(l.href && l.label));

  return (
    <>
      <PageHeader
        title={group.title}
        lede={group.summary}
        eyebrow={<Breadcrumbs items={[{ label: "Župnija", href: routes.parish }, { label: "Skupine", href: routes.groups }, { label: group.title }]} />}
      />
      <Section>
        <Container className="grid gap-12 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:gap-16">
          <div>
            {hasImage(group.image) ? (
              <SanityImage image={group.image} aspect={3 / 2} sizes="(min-width: 1024px) 40rem, 100vw" maxWidth={1400} priority className="mb-10 overflow-hidden rounded-lg shadow-soft" imgClassName="saturate-[.7]" />
            ) : null}
            <RichText value={group.description} size="lg" />
            {group.events?.length ? (
              <section className="mt-12">
                <h2 className="eyebrow mb-3">Prihajajoči dogodki skupine</h2>
                <EventList events={group.events} />
              </section>
            ) : null}
          </div>
          <aside>
            <div className="rounded-lg bg-surface p-6 shadow-soft sm:p-8">
              <h2 className="text-h3">Pridružite se</h2>
              <div className="mt-4 space-y-3">
                {group.meetingSchedule ? <MetaRow icon="clock">{group.meetingSchedule}</MetaRow> : null}
                {group.location ? <MetaRow icon="pin">{group.location}</MetaRow> : null}
                {group.contactName && !group.contactPerson ? <MetaRow icon="link">Kontakt: {group.contactName}</MetaRow> : null}
                {group.phone ? (
                  <MetaRow icon="phone">
                    <a href={telHref(group.phone)} className="hover:underline">
                      {group.phone}
                    </a>
                  </MetaRow>
                ) : null}
                {group.email ? (
                  <MetaRow icon="mail">
                    <a href={`mailto:${group.email}`} className="hover:underline">
                      {group.email}
                    </a>
                  </MetaRow>
                ) : null}
              </div>
              {group.contactPerson ? (
                <div className="mt-6 border-t border-stone/70 pt-5">
                  <PersonCard person={group.contactPerson} />
                </div>
              ) : null}
              {links.length ? (
                <ul className="mt-6 space-y-1 border-t border-stone/70 pt-5">
                  {links.map((l) => (
                    <li key={l.key}>
                      <TextLink href={l.href} external={isExternalHref(l.href)}>
                        {l.label}
                      </TextLink>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          </aside>
        </Container>
      </Section>
      {group.gallery?.length ? (
        <Section>
          <Container>
            <SectionHeading eyebrow="Fotografije" title="Utrinki skupine" accent="skupine" />
            <PhotoGrid images={group.gallery} title={group.title} />
          </Container>
        </Section>
      ) : null}
      <JsonLdScript data={breadcrumbJsonLd([{ name: "Župnija", path: routes.parish }, { name: "Skupine", path: routes.groups }, { name: group.title, path: routes.group(slug) }], settings)} />
    </>
  );
}
