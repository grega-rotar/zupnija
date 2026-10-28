import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getSettings } from "@/sanity/data";
import { getPrayerPage } from "@/lib/prayer/page";
import { buildMetadata } from "@/lib/seo";
import { routes } from "@/lib/routes";
import { cn } from "@/lib/utils";
import { RichText, type PortableTextValue } from "@/components/sanity/RichText";
import { SanityImage, hasImage } from "@/components/sanity/SanityImage";
import { Icon } from "@/components/ui/Icon";
import { Breadcrumbs, Container, PageHeader, Section, tile } from "@/components/ui/primitives";
import candles from "@/components/home/prayer-svece.webp";

export async function generateMetadata(): Promise<Metadata> {
  const [settings, page] = await Promise.all([getSettings(), getPrayerPage()]);
  return buildMetadata({
    settings,
    title: page?.title || "Molitev in češčenje",
    description: "Češčenje Najsvetejšega, rožni venec in skupna molitev v župniji Pirniče: kdaj in kje.",
    path: routes.prayer,
  });
}

/**
 * "Molitev in češčenje" (US-012): adoration, rosary and prayer times from
 * the prayerPage singleton. A 404 while it has no items.
 */
export default async function PrayerPage() {
  const page = await getPrayerPage();
  if (!page) notFound();
  const title = page.title || "Molitev in češčenje";

  return (
    <>
      <PageHeader
        title={title}
        accent={title.includes("češčenje") ? "češčenje" : null}
        eyebrow={<Breadcrumbs items={[{ label: "Župnija", href: routes.parish }, { label: "Molitev" }]} />}
        lede="Češčenje Najsvetejšega, rožni venec in skupna molitev: kdaj in kje."
        image={
          hasImage(page.image) ? (
            <SanityImage image={page.image} sizes="100vw" maxWidth={2400} priority decorative fill />
          ) : (
            <div className="absolute inset-0 bg-cover bg-[position:50%_100%] [filter:saturate(.85)]" style={{ backgroundImage: `url(${candles.src})` }} />
          )
        }
      />

      <Section>
        <Container width="prose">
          {page.intro?.length ? <RichText value={page.intro as PortableTextValue} size="lg" className="mx-auto mb-12" /> : null}
          <ul className="grid gap-4" aria-label="Molitvene ure">
            {page.items.map((i) => (
              <li key={i._key} className={cn(tile, "grid grid-cols-[2.75rem_1fr] items-start gap-4 p-5 sm:grid-cols-[3rem_1fr] sm:gap-5 sm:p-7")}>
                <span className="flex size-11 items-center justify-center rounded-full bg-gold-soft text-gold-ink sm:size-12" aria-hidden="true">
                  <Icon name="clock" size={20} />
                </span>
                <div className="min-w-0 pt-0.5">
                  <h2 className="text-[1.375rem] font-bold leading-tight tracking-[-0.035em] text-ink">{i.title}</h2>
                  <p className="mt-1 text-body text-ink-2">
                    <span className="tnum">{i.when}</span>
                    {i.place ? <span className="text-ink-3"> · {i.place}</span> : null}
                  </p>
                  {i.note ? <p className="mt-2 text-small text-ink-3">{i.note}</p> : null}
                </div>
              </li>
            ))}
          </ul>
        </Container>
      </Section>
    </>
  );
}
