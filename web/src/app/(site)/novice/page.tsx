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
      <PageHeader title="Novice" lede="Iz življenja župnije." />
      <Section tight tone="paper-2">
        <Container>
          <ArticleList articles={articles} />
        </Container>
      </Section>
    </>
  );
}
