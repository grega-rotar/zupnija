import type { Metadata } from "next";
import { getChurches, getPage, getPeople, getSettings } from "@/sanity/data";
import { buildMetadata } from "@/lib/seo";
import { routes } from "@/lib/routes";
import { PageSections, PersonCard } from "@/components/sections/PageSections";
import { ChurchCard } from "@/components/churches/ChurchCard";
import { PageHero } from "@/components/layout/PageHero";
import { Container, Section, SectionHeading, TextLink } from "@/components/ui/primitives";

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
  const [settings, page, churches, people] = await Promise.all([getSettings(), getPage(ABOUT_SLUG), getChurches(), getPeople()]);

  const clergy = people.filter((p) => ["pastor", "assistant", "helper", "deacon"].includes(p.role));

  return (
    <>
      <PageHero settings={settings} header="parishHeader" title={page?.title || "O župniji"} accent="župniji" lede={page?.intro || settings?.tagline}>
        {settings?.diocese ? <p className="mt-4 text-small font-medium opacity-80">{settings.diocese}</p> : null}
      </PageHero>

      <PageSections sections={page?.sections} />

      {churches.length ? (
        <Section>
          <Container>
            <SectionHeading eyebrow="Cerkve" title="Naše cerkve" accent="cerkve" lede="Tri cerkve pod Šmarno goro." action={{ label: "Vse o cerkvah", href: routes.churches }} />
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
            <SectionHeading eyebrow="Duhovniki" title="Kdo skrbi za župnijo" accent="za župnijo" action={{ label: "Vsi sodelavci", href: routes.people }} />
            <div className={clergy.length > 1 ? "grid gap-5 md:grid-cols-2" : "mx-auto max-w-xl"}>
              {clergy.map((p) => (
                <PersonCard key={p._id} person={p} card />
              ))}
            </div>
          </Container>
        </Section>
      ) : null}

      {/* Only the way to the groups (ZUP-26); "Skupine" in the main menu leads to the same page. */}
      <Section>
        <Container className="flex flex-col items-center text-center">
          <SectionHeading title="Župnija živi po ljudeh" className="mb-3 lg:mb-4" />
          <TextLink href={routes.groups}>Vse skupine</TextLink>
        </Container>
      </Section>
    </>
  );
}
