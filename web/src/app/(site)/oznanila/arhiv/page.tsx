import type { Metadata } from "next";
import { getArchivedAnnouncements, getSettings } from "@/sanity/data";
import { buildMetadata } from "@/lib/seo";
import { routes } from "@/lib/routes";
import { AnnouncementList } from "@/components/announcements/AnnouncementCard";
import { Breadcrumbs, Container, PageHeader, Section } from "@/components/ui/primitives";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSettings();
  return buildMetadata({ settings, title: "Arhiv oznanil", path: routes.announcementsArchive });
}

export default async function AnnouncementsArchivePage() {
  const items = await getArchivedAnnouncements();
  return (
    <>
      <PageHeader
        title="Arhiv oznanil"
        accent="oznanil"
        lede="Oznanila, ki niso več aktualna."
        eyebrow={<Breadcrumbs items={[{ label: "Oznanila", href: routes.announcements }, { label: "Arhiv" }]} />}
      />
      <Section>
        <Container>
          <AnnouncementList items={items} compact emptyText="Arhiv je še prazen." />
        </Container>
      </Section>
    </>
  );
}
