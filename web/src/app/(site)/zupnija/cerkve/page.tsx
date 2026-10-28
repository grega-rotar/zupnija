import type { Metadata } from "next";
import { getChurches, getSettings } from "@/sanity/data";
import { buildMetadata } from "@/lib/seo";
import { routes } from "@/lib/routes";
import { ChurchCard } from "@/components/churches/ChurchCard";
import { Breadcrumbs, Container, EmptyState, PageHeader, Section } from "@/components/ui/primitives";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSettings();
  return buildMetadata({
    settings,
    title: "Cerkve",
    description: "Župnijska in podružnične cerkve župnije Pirniče: kje so, kdaj so maše, kako do njih.",
    path: routes.churches,
  });
}

export default async function ChurchesPage() {
  const churches = await getChurches();
  return (
    <>
      <PageHeader
        title="Naše cerkve"
        accent="cerkve"
        lede="Župnijska cerkev in podružnice. Pri vsaki najdete urnik svetih maš, naslov in dostop."
        eyebrow={<Breadcrumbs items={[{ label: "Župnija", href: routes.parish }, { label: "Cerkve" }]} />}
      />
      <Section>
        <Container>
          {churches.length ? (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {churches.map((c, i) => (
                <ChurchCard key={c._id} church={c} priority={i < 2} />
              ))}
            </div>
          ) : (
            <EmptyState title="Cerkve še niso vpisane" />
          )}
        </Container>
      </Section>
    </>
  );
}
