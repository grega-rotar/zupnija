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
        <div className="mt-5 flex flex-wrap items-center gap-3 text-small text-ink-3">
          <time dateTime={item.publishFrom}>{formatDate(dateOf(item.publishFrom))}</time>
          {importance === "urgent" ? (
            <Tag tone="alert">Nujno</Tag>
          ) : importance === "important" ? (
            <Tag tone="gold">Pomembno</Tag>
          ) : null}
          {expired ? <Tag tone="onDark">Ni več aktualno</Tag> : null}
        </div>
      </PageHeader>
      <Section tight>
        <Container>
          <div className="max-w-prose">
            {item.summary ? <p className="text-lede text-ink-2">{item.summary}</p> : null}
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
              <section className="mt-10">
                <h2 className="mb-2 text-h3">Povezan dogodek</h2>
                <ul>
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
