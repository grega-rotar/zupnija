import type { Metadata } from "next";
import { getGalleries, getSettings } from "@/sanity/data";
import { buildMetadata } from "@/lib/seo";
import { routes } from "@/lib/routes";
import { GalleryCard } from "@/components/gallery/GalleryCard";
import { Container, EmptyState, PageHeader, Section } from "@/components/ui/primitives";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSettings();
  return buildMetadata({
    settings,
    title: "Galerije",
    description: "Fotografije iz življenja župnije Pirniče.",
    path: routes.galleries,
  });
}

export default async function GalleriesPage() {
  const galleries = await getGalleries();
  return (
    <>
      <PageHeader title="Galerije" lede="Fotografije s praznovanj, romanj in srečanj." />
      <Section tight tone="paper-2">
        <Container>
          {galleries.length ? (
            <div className="grid grid-cols-2 gap-x-6 gap-y-10 lg:grid-cols-3 lg:gap-x-8">
              {galleries.map((g) => (
                <GalleryCard key={g._id} gallery={g} />
              ))}
            </div>
          ) : (
            <EmptyState title="Galerij še ni" text="Fotografije bodo objavljene po prvih dogodkih." />
          )}
        </Container>
      </Section>
    </>
  );
}
