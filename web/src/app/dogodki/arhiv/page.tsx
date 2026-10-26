import type { Metadata } from "next";
import { getPastEvents, getSettings } from "@/sanity/data";
import { buildMetadata } from "@/lib/seo";
import { routes } from "@/lib/routes";
import { EventList } from "@/components/events/EventCard";
import { Breadcrumbs, Container, PageHeader, Section } from "@/components/ui/primitives";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSettings();
  return buildMetadata({ settings, title: "Pretekli dogodki", path: routes.eventsArchive });
}

export default async function PastEventsPage() {
  const events = await getPastEvents();
  return (
    <>
      <PageHeader
        title="Pretekli dogodki"
        eyebrow={<Breadcrumbs items={[{ label: "Dogodki", href: routes.events }, { label: "Pretekli" }]} />}
      />
      <Section tight tone="paper-2">
        <Container>
          <EventList events={events} emptyText="Preteklih dogodkov še ni." />
        </Container>
      </Section>
    </>
  );
}
