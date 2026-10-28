import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getSettings } from "@/sanity/data";
import { bulletinLabel, getBulletinCovering } from "@/lib/data/bulletins";
import { getEventsInRange } from "@/lib/data/events";
import { getMassDays } from "@/lib/data/masses";
import { buildMetadata } from "@/lib/seo";
import { routes } from "@/lib/routes";
import { addDays, formatWeekSpan, isIsoDate, startOfWeek } from "@/lib/dates";
import { BulletinView } from "@/components/announcements/BulletinView";
import { DayCard } from "@/components/masses/MassList";
import { Breadcrumbs, Container, PageHeader, Section, TextLink } from "@/components/ui/primitives";
import { today } from "@/lib/clock";

/**
 * /oznanila/teden/<date>: the old weekly address, kept working. Shows the
 * week (Sunday–Saturday) containing <date> — its Masses and intentions —
 * inside the published bulletin covering it (a month today, a week before).
 * Without a bulletin, the week's Masses alone.
 */
type Props = { params: Promise<{ week: string }> };

async function load(date: string) {
  const week = startOfWeek(date);
  const end = addDays(week, 6);
  // The bulletin covering the asked day, else any day of its week.
  const bulletin = (await getBulletinCovering(date)) ?? (await getBulletinCovering(week)) ?? (await getBulletinCovering(end));
  return { week, end, bulletin };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { week: date } = await params;
  if (!isIsoDate(date)) return {};
  const [settings, { week, end, bulletin }] = await Promise.all([getSettings(), load(date)]);
  return buildMetadata({
    settings,
    title: bulletin ? `Oznanila ${bulletinLabel(bulletin)}` : `Svete maše ${formatWeekSpan(week, end, true)}`,
    path: routes.bulletin(date),
  });
}

export default async function BulletinWeekPage({ params }: Props) {
  const { week: date } = await params;
  if (!isIsoDate(date)) notFound();
  const { week, end, bulletin } = await load(date);
  const massDays = await getMassDays(week, end);
  const span = formatWeekSpan(week, end, true);

  if (!bulletin) {
    if (!massDays.some((d) => d.masses.length)) notFound();
    return (
      <>
        <PageHeader
          title={`Svete maše ${span}`}
          lede="Za ta teden ni objavljenih oznanil."
          eyebrow={<Breadcrumbs items={[{ label: "Oznanila", href: routes.announcements }, { label: span }]} />}
        />
        <Section tight tone="paper-2">
          <Container>
            <div className="divide-y divide-stone border-t border-stone">
              {massDays.map((day) => (
                <DayCard key={day.date} day={day} today={today()} showIntentions plain className="py-5" />
              ))}
            </div>
            <div className="mt-6">
              <TextLink href={routes.announcements}>Najnovejša oznanila</TextLink>
            </div>
          </Container>
        </Section>
      </>
    );
  }

  const events = await getEventsInRange(bulletin.periodStart, bulletin.periodEnd);
  return (
    <Section tight>
      <Container>
        <Breadcrumbs
          className="mb-8 text-ink-3"
          items={[
            { label: "Oznanila", href: routes.announcements },
            { label: "Vsa oznanila", href: routes.bulletins },
            { label: bulletinLabel(bulletin) },
          ]}
        />
        <BulletinView bulletin={bulletin} massDays={massDays} massHeading={formatWeekSpan(week, end)} events={events} headingLevel="h1" />
      </Container>
    </Section>
  );
}
