import type { Metadata } from "next";
import { getGroups, getSettings } from "@/sanity/data";
import { buildMetadata } from "@/lib/seo";
import { routes } from "@/lib/routes";
import { GroupRow } from "@/components/groups/GroupRow";
import { Breadcrumbs, Container, EmptyState, PageHeader, Section } from "@/components/ui/primitives";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSettings();
  return buildMetadata({
    settings,
    title: "Skupine",
    description: "Pevski zbori, ministranti, Karitas, mladi in druge skupine v župniji Pirniče.",
    path: routes.groups,
  });
}

export default async function GroupsPage() {
  const groups = await getGroups();
  return (
    <>
      <PageHeader
        title="Župnijske skupine"
        accent="skupine"
        lede="Župnija živi po ljudeh, ki se srečujejo, pojejo, molijo in pomagajo. Vsaka skupina vas rada sprejme."
        eyebrow={<Breadcrumbs items={[{ label: "Župnija", href: routes.parish }, { label: "Skupine" }]} />}
      />
      <Section>
        <Container>
          {groups.length ? (
            <ul className="grid gap-5 md:grid-cols-2">
              {groups.map((g) => (
                <GroupRow key={g._id} group={g} />
              ))}
            </ul>
          ) : (
            <EmptyState title="Skupine še niso vpisane" />
          )}
        </Container>
      </Section>
    </>
  );
}
