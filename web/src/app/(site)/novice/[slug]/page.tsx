import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getArticle, getSettings } from "@/sanity/data";
import { absoluteUrl, breadcrumbJsonLd, buildMetadata, type JsonLd } from "@/lib/seo";
import { routes } from "@/lib/routes";
import { dateOf, formatDateLong } from "@/lib/dates";
import { urlFor } from "@/sanity/image";
import { Attachments, RichText } from "@/components/sanity/RichText";
import { Figure, hasImage } from "@/components/sanity/SanityImage";
import { PhotoGrid } from "@/components/gallery/PhotoGrid";
import { ArticleCard } from "@/components/articles/ArticleCard";
import { EventRow } from "@/components/events/EventCard";
import { Share } from "@/components/share/Share";
import { Breadcrumbs, Container, JsonLdScript, Section, SectionHeading, headline, tile } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const [settings, article] = await Promise.all([getSettings(), getArticle(slug, false)]);
  if (!article) return {};
  return buildMetadata({
    settings,
    title: article.title,
    description: article.excerpt,
    path: routes.article(slug),
    seo: article.seo,
    image: article.image,
    type: "article",
    publishedTime: article.publishedAt,
  });
}

export default async function ArticlePage({ params }: Props) {
  const { slug } = await params;
  const [settings, article] = await Promise.all([getSettings(), getArticle(slug)]);
  if (!article) notFound();

  const jsonLd: JsonLd = {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    headline: article.title,
    description: article.excerpt,
    datePublished: article.publishedAt,
    url: absoluteUrl(routes.article(slug), settings),
    ...(hasImage(article.image) ? { image: [urlFor(article.image).width(1200).height(630).fit("crop").url()] } : {}),
    author: { "@type": article.author ? "Person" : "Organization", name: article.author?.name ?? settings?.name ?? "Župnija Pirniče" },
    publisher: { "@type": "Organization", name: settings?.name ?? "Župnija Pirniče" },
  };

  return (
    <>
      <article>
        <header className="pb-12 pt-10 sm:pt-14 lg:pb-16 lg:pt-20">
          <Container className="flex flex-col items-center text-center">
            <Breadcrumbs className="mb-6 text-ink-3 [&_[aria-current]]:text-gold-ink" items={[{ label: "Novice", href: routes.news }, { label: article.title }]} />
            <p className="eyebrow">
              <time dateTime={article.publishedAt}>{formatDateLong(dateOf(article.publishedAt))}</time>
              {article.author ? <span> · {article.author.name}</span> : null}
            </p>
            <h1 className={cn("mt-3 max-w-4xl", headline.display)}>{article.title}</h1>
            {article.excerpt ? <p className="lede mx-auto mt-5 max-w-[40rem] text-balance lg:mt-6">{article.excerpt}</p> : null}
            <Share title={article.title} url={absoluteUrl(routes.article(slug), settings)} className="mt-6" />
          </Container>
        </header>

        {hasImage(article.image) ? (
          <Container>
            <Figure
              image={article.image}
              aspect={16 / 9}
              sizes="(min-width: 1280px) 77rem, 100vw"
              maxWidth={2000}
              priority
              className="overflow-hidden rounded-[2rem] shadow-soft sm:rounded-xl [&_img]:saturate-[.75]"
            />
          </Container>
        ) : null}

        <Section>
          <Container width="prose">
            <RichText value={article.body} size="lg" />
            <Attachments items={article.attachments} />
            {article.relatedEvent ? (
              <section className="mt-12">
                <h2 className="eyebrow mb-3">Povezan dogodek</h2>
                <ul className={cn(tile, "overflow-hidden")}>
                  <EventRow event={article.relatedEvent} />
                </ul>
              </section>
            ) : null}
          </Container>
        </Section>

        {article.gallery?.images?.length ? (
          <Section>
            <Container>
              <SectionHeading eyebrow="Fotografije" title={article.gallery.title} action={{ label: "Odpri galerijo", href: routes.gallery(article.gallery.slug) }} />
              <PhotoGrid images={article.gallery.images} title={article.gallery.title} />
            </Container>
          </Section>
        ) : null}
      </article>

      {article.related?.length ? (
        <Section>
          <Container>
            <SectionHeading eyebrow="Novice" title="Iz življenja župnije" accent="življenja" action={{ label: "Vse novice", href: routes.news }} />
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {article.related.map((a) => (
                <ArticleCard key={a._id} article={a} />
              ))}
            </div>
          </Container>
        </Section>
      ) : null}

      <JsonLdScript data={jsonLd} />
      <JsonLdScript data={breadcrumbJsonLd([{ name: "Novice", path: routes.news }, { name: article.title, path: routes.article(slug) }], settings)} />
    </>
  );
}
