import type { Metadata } from "next";
import { getArticles, getSettings } from "@/sanity/data";
import { buildMetadata } from "@/lib/seo";
import { routes } from "@/lib/routes";
import { ArticleList } from "@/components/articles/ArticleCard";
import { Container, PageHeader, Section } from "@/components/ui/primitives";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSettings();
  return buildMetadata({
    settings,
    title: "Novice",
    description: "Novice iz življenja župnije Pirniče.",
    path: routes.news,
  });
}

export default async function NewsPage() {
  const articles = await getArticles();
  return (
    <>
      <PageHeader title="Iz življenja župnije" accent="življenja" lede="Novice, zahvale in utrinki iz župnije." eyebrow={<p className="eyebrow">Novice</p>} />
      <Section>
        <Container>
          <ArticleList articles={articles} />
        </Container>
      </Section>
    </>
  );
}
