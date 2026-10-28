import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPage, getSettings } from "@/sanity/data";
import { breadcrumbJsonLd, buildMetadata } from "@/lib/seo";
import { routes } from "@/lib/routes";
import { PageSections } from "@/components/sections/PageSections";
import { JsonLdScript, PageHeader } from "@/components/ui/primitives";

type Props = { params: Promise<{ slug: string }> };

/** Editorial pages built from approved sections, e.g. /zasebnost. */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const [settings, page] = await Promise.all([getSettings(), getPage(slug, false)]);
  if (!page) return {};
  return buildMetadata({ settings, title: page.title, description: page.intro, path: routes.page(slug), seo: page.seo });
}

export default async function GenericPage({ params }: Props) {
  const { slug } = await params;
  const [settings, page] = await Promise.all([getSettings(), getPage(slug)]);
  if (!page) notFound();

  return (
    <>
      <PageHeader title={page.title} lede={page.intro} />
      <PageSections sections={page.sections} />
      <JsonLdScript data={breadcrumbJsonLd([{ name: page.title, path: routes.page(slug) }], settings)} />
    </>
  );
}
