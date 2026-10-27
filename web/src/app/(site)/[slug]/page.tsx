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

  const startsWithHero = page.sections?.[0]?._type === "sectionHero";

  return (
    <>
      {!startsWithHero ? <PageHeader title={page.title} lede={page.intro} /> : null}
      {startsWithHero ? (
        <header className="pb-8 pt-8 sm:pt-12">
          <div className="mx-auto w-full max-w-content px-4 sm:px-6 lg:px-8">
            <h1 className="text-h1">{page.title}</h1>
            {page.intro ? <p className="mt-4 max-w-prose text-lede text-ink-2">{page.intro}</p> : null}
          </div>
        </header>
      ) : null}
      <PageSections sections={page.sections} />
      <JsonLdScript data={breadcrumbJsonLd([{ name: page.title, path: routes.page(slug) }], settings)} />
    </>
  );
}
