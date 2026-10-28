import type { Metadata } from "next";
import Link from "next/link";
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
import { Breadcrumbs, Container, JsonLdScript, Section } from "@/components/ui/primitives";

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
        <header className="pb-8 pt-10 sm:pt-16">
          <Container width="prose" className="max-w-3xl">
            <Breadcrumbs className="mb-6 text-ink-3" items={[{ label: "Novice", href: routes.news }, { label: article.title }]} />
            <h1 className="text-display">{article.title}</h1>
            <p className="mt-4 text-small text-ink-3">
              <time dateTime={article.publishedAt}>{formatDateLong(dateOf(article.publishedAt))}</time>
              {article.author ? <span> · {article.author.name}</span> : null}
            </p>
            {article.excerpt ? <p className="mt-5 text-lede text-ink-2">{article.excerpt}</p> : null}
          </Container>
        </header>

        {hasImage(article.image) ? (
          <Container className="max-w-5xl">
            <Figure image={article.image} aspect={16 / 9} sizes="(min-width: 1024px) 64rem, 100vw" maxWidth={1800} priority className="rounded-md" />
          </Container>
        ) : null}

        <Section tight>
          <Container width="prose" className="max-w-3xl">
            <RichText value={article.body} size="lg" />
            <Attachments items={article.attachments} />
            {article.relatedEvent ? (
              <section className="mt-10">
                <h2 className="mb-2 text-h3">Povezan dogodek</h2>
                <ul>
                  <EventRow event={article.relatedEvent} />
                </ul>
              </section>
            ) : null}
          </Container>
        </Section>

        {article.gallery?.images?.length ? (
          <Section tight tone="paper-2">
            <Container>
              <div className="mb-6 flex flex-wrap items-baseline justify-between gap-4">
                <h2 className="text-h3">{article.gallery.title}</h2>
                <Link href={routes.gallery(article.gallery.slug)} className="text-small text-moss underline underline-offset-4">
                  Odpri galerijo
                </Link>
              </div>
              <PhotoGrid images={article.gallery.images} title={article.gallery.title} />
            </Container>
          </Section>
        ) : null}
      </article>

      {article.related?.length ? (
        <Section tight tone="paper-2">
          <Container>
            <h2 className="mb-6 text-h3">Več novic</h2>
            <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3 lg:gap-6">
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
