import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getGallery, getSettings } from "@/sanity/data";
import { buildMetadata } from "@/lib/seo";
import { routes } from "@/lib/routes";
import { formatDateLong } from "@/lib/dates";
import { RichText } from "@/components/sanity/RichText";
import { PhotoGrid } from "@/components/gallery/PhotoGrid";
import { Breadcrumbs, Container, PageHeader, Section } from "@/components/ui/primitives";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const [settings, gallery] = await Promise.all([getSettings(), getGallery(slug, false)]);
  if (!gallery) return {};
  return buildMetadata({
    settings,
    title: gallery.title,
    description: `${gallery.count ?? 0} fotografij · ${formatDateLong(gallery.date)}`,
    path: routes.gallery(slug),
    image: gallery.cover,
  });
}

export default async function GalleryPage({ params }: Props) {
  const { slug } = await params;
  const gallery = await getGallery(slug);
  if (!gallery) notFound();

  return (
    <>
      <PageHeader
        title={gallery.title}
        eyebrow={<Breadcrumbs items={[{ label: "Galerije", href: routes.galleries }, { label: gallery.title }]} />}
      >
        <p className="mt-5 text-small text-ink-3">
          <time dateTime={gallery.date}>{formatDateLong(gallery.date)}</time>
          {gallery.count ? ` · ${gallery.count} fotografij` : ""}
          {gallery.photographer ? ` · Foto: ${gallery.photographer}` : ""}
          {gallery.relatedEvent ? (
            <>
              {" · "}
              <Link href={routes.event(gallery.relatedEvent.slug)} className="text-moss underline underline-offset-4 hover:text-moss-deep">
                {gallery.relatedEvent.title}
              </Link>
            </>
          ) : null}
        </p>
        <RichText value={gallery.description} className="mt-4 text-ink-2" />
      </PageHeader>
      <Section tight>
        <Container>
          <PhotoGrid images={gallery.images} title={gallery.title} />
        </Container>
      </Section>
    </>
  );
}
