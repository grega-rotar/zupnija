import type { Metadata } from "next";
import { getSettings, getUpcomingEvents } from "@/sanity/data";
import { buildMetadata } from "@/lib/seo";
import { routes } from "@/lib/routes";
import { EventList } from "@/components/events/EventCard";
import { PageHero } from "@/components/layout/PageHero";
import { Container, Section, TextLink } from "@/components/ui/primitives";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSettings();
  return buildMetadata({
    settings,
    title: "Dogodki",
    description: "Prihajajoči dogodki v župniji Pirniče: prazniki, romanja, srečanja, verouk.",
    path: routes.events,
  });
}

export default async function EventsPage() {
  const [settings, events] = await Promise.all([getSettings(), getUpcomingEvents()]);
  return (
    <>
      <PageHero settings={settings} header="eventsHeader" title="Dogodki" lede="Kaj se pripravlja v župniji v prihodnjih tednih." />
      <Section tight tone="paper-2">
        <Container>
          <EventList events={events} />
          <p className="mt-8">
            <TextLink href={routes.eventsArchive}>Pretekli dogodki</TextLink>
          </p>
        </Container>
      </Section>
    </>
  );
}
