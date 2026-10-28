import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getAnnouncement, getSettings } from "@/sanity/data";
import { buildMetadata, breadcrumbJsonLd } from "@/lib/seo";
import { routes } from "@/lib/routes";
import { dateOf, formatDate } from "@/lib/dates";
import { hrefFor, isExternalHref } from "@/lib/links";
import { clean } from "@/lib/clean";
import { Attachments, RichText } from "@/components/sanity/RichText";
import { EventRow } from "@/components/events/EventCard";
import {
  Breadcrumbs,
  Button,
  Container,
  JsonLdScript,
  PageHeader,
  Section,
  Tag,
} from "@/components/ui/primitives";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const [settings, item] = await Promise.all([getSettings(), getAnnouncement(slug, false)]);
  if (!item) return {};
  return buildMetadata({
    settings,
    title: item.title,
    description: item.summary,
    path: routes.announcement(slug),
    type: "article",
    publishedTime: item.publishFrom,
  });
}

export default async function AnnouncementPage({ params }: Props) {
  const { slug } = await params;
  const [settings, item] = await Promise.all([getSettings(), getAnnouncement(slug)]);
  if (!item) notFound();

  const importance = clean(item.importance);
  const expired = item.publishUntil ? new Date(item.publishUntil) < new Date() : false;
  const ctaHref = hrefFor(item.cta);

  return (
    <>
      <PageHeader
        title={item.title}
        eyebrow={<Breadcrumbs items={[{ label: "Oznanila", href: routes.announcements }, { label: item.title }]} />}
      >
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3 text-small font-medium text-ink-3">
          <time dateTime={item.publishFrom}>{formatDate(dateOf(item.publishFrom))}</time>
          {importance === "urgent" ? (
            <Tag tone="alert">Nujno</Tag>
          ) : importance === "important" ? (
            <Tag tone="gold">Pomembno</Tag>
          ) : null}
          {expired ? <Tag>Ni več aktualno</Tag> : null}
        </div>
      </PageHeader>
      <Section>
        <Container width="prose">
          <div>
            {item.summary ? <p className="text-[clamp(1.25rem,1.1rem+0.6vw,1.5rem)] font-semibold leading-snug tracking-[-0.025em] text-ink">{item.summary}</p> : null}
            <RichText value={item.body} className="mt-6" />
            {ctaHref && item.cta?.label ? (
              <div className="mt-8">
                <Button
                  href={ctaHref}
                  external={isExternalHref(ctaHref)}
                  icon={isExternalHref(ctaHref) ? "external" : "arrow-right"}
                >
                  {item.cta.label}
                </Button>
              </div>
            ) : null}
            <Attachments items={item.attachments} />
            {item.relatedEvent ? (
              <section className="mt-12">
                <h2 className="eyebrow mb-3">Povezan dogodek</h2>
                <ul className="overflow-hidden rounded-lg bg-surface shadow-soft">
                  <EventRow event={item.relatedEvent} />
                </ul>
              </section>
            ) : null}
          </div>
        </Container>
      </Section>
      <JsonLdScript
        data={breadcrumbJsonLd(
          [
            { name: "Oznanila", path: routes.announcements },
            { name: item.title, path: routes.announcement(slug) },
          ],
          settings,
        )}
      />
    </>
  );
}
