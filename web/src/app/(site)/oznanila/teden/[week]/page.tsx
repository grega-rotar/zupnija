import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getSettings } from "@/sanity/data";
import { getBulletinByWeek } from "@/lib/data/bulletins";
import { getEventsInRange } from "@/lib/data/events";
import { getMassDays } from "@/lib/data/masses";
import { buildMetadata } from "@/lib/seo";
import { routes } from "@/lib/routes";
import { formatWeekSpan, isIsoDate } from "@/lib/dates";
import { BulletinView } from "@/components/announcements/BulletinView";
import { Breadcrumbs, Container, Section } from "@/components/ui/primitives";

type Props = { params: Promise<{ week: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { week } = await params;
  if (!isIsoDate(week)) return {};
  const [settings, bulletin] = await Promise.all([getSettings(), getBulletinByWeek(week)]);
  if (!bulletin) return {};
  return buildMetadata({
    settings,
    title: `Tedenska oznanila ${formatWeekSpan(bulletin.weekStart, bulletin.weekEnd, true)}`,
    path: routes.bulletin(week),
  });
}

export default async function BulletinPage({ params }: Props) {
  const { week } = await params;
  if (!isIsoDate(week)) notFound();
  const bulletin = await getBulletinByWeek(week);
  if (!bulletin) notFound();
  const [massDays, events] = await Promise.all([
    getMassDays(bulletin.weekStart, bulletin.weekEnd),
    getEventsInRange(bulletin.weekStart, bulletin.weekEnd),
  ]);

  return (
    <Section tight>
      <Container>
        <Breadcrumbs
          className="mb-8 text-ink-3"
          items={[
            { label: "Oznanila", href: routes.announcements },
            { label: "Tedenska oznanila", href: routes.bulletins },
            { label: formatWeekSpan(bulletin.weekStart, bulletin.weekEnd, true) },
          ]}
        />
        <BulletinView bulletin={bulletin} massDays={massDays} events={events} headingLevel="h1" />
      </Container>
    </Section>
  );
}
