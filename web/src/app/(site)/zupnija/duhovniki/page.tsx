import type { Metadata } from "next";
import { getPeople, getSettings } from "@/sanity/data";
import { buildMetadata } from "@/lib/seo";
import { routes } from "@/lib/routes";
import { clean } from "@/lib/clean";
import { PersonCard } from "@/components/sections/PageSections";
import { Breadcrumbs, Container, EmptyState, PageHeader, Section, SectionHeading } from "@/components/ui/primitives";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSettings();
  return buildMetadata({
    settings,
    title: "Duhovniki in sodelavci",
    description: "Kdo skrbi za župnijo Pirniče: župnik, duhovniki in pastoralni sodelavci.",
    path: routes.people,
  });
}

const CLERGY = new Set(["pastor", "assistant", "helper", "deacon"]);

export default async function PeoplePage() {
  const people = await getPeople();
  const clergy = people.filter((p) => CLERGY.has(clean(p.role)));
  const staff = people.filter((p) => !CLERGY.has(clean(p.role)));

  return (
    <>
      <PageHeader
        title="Duhovniki in sodelavci"
        accent="sodelavci"
        eyebrow={<Breadcrumbs items={[{ label: "Župnija", href: routes.parish }, { label: "Duhovniki in sodelavci" }]} />}
      />
      <Section>
        <Container>
          {!people.length ? <EmptyState title="Podatki še niso vpisani" /> : null}
          {clergy.length ? (
            <div className={clergy.length > 1 ? "grid gap-5 md:grid-cols-2" : "mx-auto max-w-xl"}>
              {clergy.map((p) => (
                <PersonCard key={p._id} person={p} card />
              ))}
            </div>
          ) : null}
          {staff.length ? (
            <div className={clergy.length ? "mt-24 lg:mt-40" : ""}>
              <SectionHeading title="Sodelavci" accent="Sodelavci" eyebrow="Župnija" />
              <div className="grid gap-5 md:grid-cols-2">
                {staff.map((p) => (
                  <PersonCard key={p._id} person={p} card />
                ))}
              </div>
            </div>
          ) : null}
        </Container>
      </Section>
    </>
  );
}
