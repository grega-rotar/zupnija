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
import { Container, Notice, PageHeader, Section, SectionHeading, Tag } from "@/components/ui/primitives";

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
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3 text-small font-medium text-ink-2">
          <span style={{ backgroundColor: color }} className="inline-block size-2.5 rounded-full ring-2 ring-stone" aria-hidden="true" />
          <span>{formatDateSpan(period.activeFrom, period.activeUntil)}</span>
          {over ? <Tag>Obdobje je minilo</Tag> : !active ? <Tag tone="gold">Prihaja</Tag> : null}
        </div>
        {period.officeHoursNote ? <Notice className="mx-auto mt-6 text-left">{period.officeHoursNote}</Notice> : null}
      </PageHeader>

      {hasImage(period.image) ? (
        <Container className="mt-10 lg:mt-14">
          <SanityImage
            image={period.image}
            aspect={21 / 9}
            sizes="(min-width: 1280px) 77rem, 100vw"
            maxWidth={2400}
            priority
            className="overflow-hidden rounded-[2rem] shadow-soft max-sm:aspect-[4/3]! sm:rounded-xl"
            imgClassName="[filter:saturate(.6)_sepia(.12)]"
          />
        </Container>
      ) : null}

      <Section>
        <Container width="prose">
          <RichText value={period.message} size="lg" />
          <Attachments items={period.attachments} />
        </Container>
      </Section>

      {period.schedule?.entries?.length ? (
        <Section>
          <Container>
            <SectionHeading eyebrow="Bogoslužje" title="Svete maše" accent="maše" action={{ label: "Vse svete maše", href: routes.masses }} />
            <ScheduleTable schedule={{ ...period.schedule, replacesRegular: null }} />
          </Container>
        </Section>
      ) : null}

      {period.events?.length ? (
        <Section>
          <Container>
            <SectionHeading eyebrow="Dogodki" title="Kaj se pripravlja" accent="pripravlja" />
            <EventList events={period.events} />
          </Container>
        </Section>
      ) : null}

      {period.announcements?.length ? (
        <Section>
          <Container>
            <SectionHeading eyebrow="Oznanila" title="Kaj je novega" accent="novega" />
            <AnnouncementList items={period.announcements} />
          </Container>
        </Section>
      ) : null}
    </>
  );
}
