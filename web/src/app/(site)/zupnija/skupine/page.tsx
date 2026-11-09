import type { Metadata } from "next";
import { getGroups, getSettings } from "@/sanity/data";
import { buildMetadata } from "@/lib/seo";
import { routes } from "@/lib/routes";
import { GroupCard } from "@/components/groups/GroupCard";
import { GroupSearch } from "@/components/groups/GroupSearch";
import { groupSearchText, queryParam } from "@/components/groups/groupSearch";
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

type Props = { searchParams: Promise<{ q?: string | string[] }> };

/** The parish's groups as a grid of cards, in the editor's order (ZUP-13). "Skupine" in the main menu leads here. */
export default async function GroupsPage({ searchParams }: Props) {
  const [groups, { q }] = await Promise.all([getGroups(), searchParams]);
  return (
    <>
      <PageHeader title="Skupine" eyebrow={<Breadcrumbs items={[{ label: "Župnija", href: routes.parish }, { label: "Skupine" }]} />} />
      <Section>
        <Container>
          {groups.length ? (
            <GroupSearch
              action={routes.groups}
              initialQuery={queryParam(q)}
              rows={groups.map((g) => ({ id: g._id, text: groupSearchText(g), node: <GroupCard group={g} /> }))}
            />
          ) : (
            <EmptyState title="Skupine še niso vpisane" />
          )}
        </Container>
      </Section>
    </>
  );
}
