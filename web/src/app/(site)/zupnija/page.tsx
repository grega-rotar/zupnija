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
      <PageHero settings={settings} header="parishHeader" title={page?.title || "O župniji"} />

      <PageSections sections={page?.sections} />

      {churches.length ? (
        <Section>
          <Container>
            <SectionHeading title="Naše cerkve" action={{ label: "Vse o cerkvah", href: routes.churches }} />
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {churches.map((c) => (
                <ChurchCard key={c._id} church={c} />
              ))}
            </div>
          </Container>
        </Section>
      ) : null}

      {clergy.length ? (
        <Section>
          <Container>
            <SectionHeading title="Kdo skrbi za župnijo" action={{ label: "Vsi sodelavci", href: routes.people }} />
            <div className={clergy.length > 1 ? "grid gap-5 md:grid-cols-2" : "mx-auto max-w-xl"}>
              {clergy.map((p) => (
                <PersonCard key={p._id} person={p} card />
              ))}
            </div>
          </Container>
        </Section>
      ) : null}

      {groups.length ? (
        <Section>
          <Container>
            <SectionHeading title="Župnija živi po ljudeh" action={{ label: "Vse skupine", href: routes.groups }} />
            <ul className="grid gap-5 md:grid-cols-2">
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
