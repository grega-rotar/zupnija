import type { Metadata } from "next";
import { getChurches, getGroups, getPage, getPeople, getSettings } from "@/sanity/data";
import { buildMetadata } from "@/lib/seo";
import { routes } from "@/lib/routes";
import { PageSections, PersonCard } from "@/components/sections/PageSections";
import { ChurchCard } from "@/components/churches/ChurchCard";
import { GroupRow } from "@/components/groups/GroupRow";
import { PageHero } from "@/components/layout/PageHero";
import { Container, Section, SectionHeading } from "@/components/ui/primitives";

/** Editors can enrich this page by creating a page with the slug »o-zupniji«. */
const ABOUT_SLUG = "o-zupniji";

export async function generateMetadata(): Promise<Metadata> {
  const [settings, page] = await Promise.all([getSettings(), getPage(ABOUT_SLUG, false)]);
  return buildMetadata({
    settings,
    title: page?.title || "O župniji",
    description: page?.intro || settings?.tagline,
    path: routes.parish,
    seo: page?.seo,
  });
}

export default async function ParishPage() {
  const [settings, page, churches, people, groups] = await Promise.all([
    getSettings(),
    getPage(ABOUT_SLUG),
    getChurches(),
    getPeople(),
    getGroups(),
  ]);

  const clergy = people.filter((p) => ["pastor", "assistant", "helper", "deacon"].includes(p.role));

  return (
    <>
      <PageHero settings={settings} header="parishHeader" title={page?.title || "O župniji"} lede={page?.intro || settings?.tagline}>
        {settings?.diocese ? <p className="mt-4 text-small opacity-75">{settings.diocese}</p> : null}
      </PageHero>

      <PageSections sections={page?.sections} />

      {churches.length ? (
        <Section tight tone="paper-2">
          <Container>
            <SectionHeading title="Cerkve" action={{ label: "Vse o cerkvah", href: routes.churches }} />
            <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3 lg:gap-6">
              {churches.map((c) => (
                <ChurchCard key={c._id} church={c} />
              ))}
            </div>
          </Container>
        </Section>
      ) : null}

      {clergy.length ? (
        <Section tight>
          <Container>
            <SectionHeading title="Duhovniki" action={{ label: "Vsi sodelavci", href: routes.people }} />
            <div className="grid gap-5 md:grid-cols-2">
              {clergy.map((p) => (
                <PersonCard key={p._id} person={p} card />
              ))}
            </div>
          </Container>
        </Section>
      ) : null}

      {groups.length ? (
        <Section tight tone="paper-2">
          <Container>
            <SectionHeading title="Skupine" action={{ label: "Vse skupine", href: routes.groups }} />
            <ul className="divide-y divide-stone border-y border-stone md:grid md:grid-cols-2 md:gap-x-12 md:divide-y-0 md:border-y-0 md:[&>li]:border-t md:[&>li]:border-stone">
              {groups.slice(0, 6).map((g) => (
                <GroupRow key={g._id} group={g} />
              ))}
            </ul>
          </Container>
        </Section>
      ) : null}
    </>
  );
}
