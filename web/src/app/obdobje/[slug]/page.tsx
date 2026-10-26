import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getSettings, getSpecialPeriod } from "@/sanity/data";
import { buildMetadata } from "@/lib/seo";
import { routes } from "@/lib/routes";
import { formatDateSpan, today } from "@/lib/dates";
import { clean } from "@/lib/clean";
import { Attachments, RichText } from "@/components/sanity/RichText";
import { SanityImage, hasImage } from "@/components/sanity/SanityImage";
import { ScheduleTable } from "@/components/masses/ScheduleTable";
import { EventList } from "@/components/events/EventCard";
import { AnnouncementList } from "@/components/announcements/AnnouncementCard";
import { SEASON_COLOR } from "@/components/home/SpecialPeriodFeature";
import { Container, Notice, PageHeader, Section, Tag, TextLink } from "@/components/ui/primitives";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const [settings, period] = await Promise.all([getSettings(), getSpecialPeriod(slug, false)]);
  if (!period) return {};
  return buildMetadata({ settings, title: period.title, path: routes.specialPeriod(slug), image: period.image });
}

/** A special period: Christmas, Easter, parish feast … with its programme. */
export default async function SpecialPeriodPage({ params }: Props) {
  const { slug } = await params;
  const period = await getSpecialPeriod(slug);
  if (!period) notFound();

  const t = today();
  const active = period.activeFrom <= t && period.activeUntil >= t;
  const over = period.activeUntil < t;
  const color = SEASON_COLOR[clean(period.season) ?? "none"] ?? SEASON_COLOR.none;

  return (
    <>
      <PageHeader title={period.title}>
        <div className="mt-5 flex flex-wrap items-center gap-3 text-small text-ink-3">
          <span style={{ backgroundColor: color }} className="inline-block size-2.5 rounded-full ring-2 ring-stone" aria-hidden="true" />
          <span>{formatDateSpan(period.activeFrom, period.activeUntil)}</span>
          {over ? <Tag tone="onDark">Obdobje je minilo</Tag> : !active ? <Tag tone="onDark">Prihaja</Tag> : null}
        </div>
        {period.officeHoursNote ? <Notice dark className="mt-6">{period.officeHoursNote}</Notice> : null}
      </PageHeader>

      {hasImage(period.image) ? (
        <SanityImage image={period.image} aspect={21 / 9} sizes="100vw" maxWidth={2400} priority className="max-sm:aspect-[4/3]" />
      ) : null}

      <Section tight>
        <Container className="[&>*]:max-w-3xl">
          <RichText value={period.message} size="lg" />
          <Attachments items={period.attachments} />
        </Container>
      </Section>

      {period.schedule?.entries?.length ? (
        <Section tight tone="paper-2">
          <Container>
            <div className="mb-8 flex flex-wrap items-baseline justify-between gap-4">
              <h2 className="text-h2">Svete maše</h2>
              <TextLink href={routes.masses}>Vse svete maše</TextLink>
            </div>
            <ScheduleTable schedule={{ ...period.schedule, replacesRegular: null }} />
          </Container>
        </Section>
      ) : null}

      {period.events?.length ? (
        <Section tight>
          <Container>
            <h2 className="mb-6 text-h2">Dogodki</h2>
            <EventList events={period.events} />
          </Container>
        </Section>
      ) : null}

      {period.announcements?.length ? (
        <Section tight className="border-t border-stone">
          <Container>
            <h2 className="mb-6 text-h2">Oznanila</h2>
            <AnnouncementList items={period.announcements} />
          </Container>
        </Section>
      ) : null}
    </>
  );
}
