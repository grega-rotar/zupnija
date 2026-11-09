import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getSacramentsPage, getSettings } from "@/sanity/data";
import { buildMetadata } from "@/lib/seo";
import { routes } from "@/lib/routes";
import { ARRANGE_HEADING } from "@/lib/sacraments/tabs";
import { RichText, type PortableTextValue } from "@/components/sanity/RichText";
import { SanityImage, hasImage } from "@/components/sanity/SanityImage";
import { Container, PageHeader, Section, headline } from "@/components/ui/primitives";
import { SacramentTabs } from "./SacramentTabs";

export async function generateMetadata(): Promise<Metadata> {
  if (!PUBLISHED) return {};
  const settings = await getSettings();
  return buildMetadata({
    settings,
    title: "Zakramenti",
    description: "Sveti krst, prvo sveto obhajilo, birma, spoved, sveti zakon, bolniško maziljenje, katehumenat in pogreb v župniji Pirniče: kako se dogovorite.",
    path: routes.sacraments,
  });
}

/**
 * Zakramenti (ZUP-11, ZUP-12): the title, the priest's intro, and one tab
 * per sacrament, then Katehumenat and Pogreb. Each tab has its own hash
 * (/zakramenti#krst) and shows its image (only when there is one), what it is
 * and how to arrange it in Pirniče. Everything comes from the sacramentsPage
 * document the priest edits in the editor (Spletna stran → Zakramenti).
 */
/** Off the public site for now (the content stays in the editor); flip to true to bring it back. */
const PUBLISHED = false;

export default async function SacramentsPage() {
  if (!PUBLISHED) notFound();
  const page = await getSacramentsPage();
  return (
    <>
      <PageHeader title="Zakramenti" crumbs={[{ label: "Župnija", href: routes.parish }, { label: "Zakramenti" }]} />
      <Section>
        <Container>
          {page.intro?.length ? <RichText value={page.intro as PortableTextValue} size="lg" className="mx-auto mb-14 max-w-[46rem] lg:mb-20" /> : null}
          <SacramentTabs
            tabs={page.tabs.map((t) => ({ key: t.key, label: t.label, apart: !!t.apart }))}
            panels={page.tabs.map((t) => (
              <div key={t.key} className="mx-auto max-w-[46rem]">
                {hasImage(t.image) ? (
                  <SanityImage
                    image={t.image}
                    aspect={16 / 9}
                    sizes="(min-width: 768px) 46rem, 100vw"
                    maxWidth={1600}
                    className="mb-10 overflow-hidden rounded-lg shadow-soft sm:mb-12"
                    imgClassName="saturate-[.7]"
                  />
                ) : null}
                <TabSection title={t.about} text={t.aboutText} />
                <TabSection title={ARRANGE_HEADING} text={t.arrangeText} className="mt-10 border-t border-stone pt-10 sm:mt-12 sm:pt-12" />
              </div>
            ))}
          />
        </Container>
      </Section>
    </>
  );
}

/** One of a tab's two texts, under its heading; nothing while the text is empty. */
function TabSection({ title, text, className }: { title: string; text: unknown; className?: string }) {
  if (!Array.isArray(text) || !text.length) return null;
  return (
    <section className={className}>
      <h2 className={headline.h3}>{title}</h2>
      <RichText value={text as PortableTextValue} size="lg" className="mt-4" />
    </section>
  );
}
