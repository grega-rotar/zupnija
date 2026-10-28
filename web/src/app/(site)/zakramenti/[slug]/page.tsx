import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getSacrament, getSettings } from "@/sanity/data";
import { breadcrumbJsonLd, buildMetadata, type JsonLd } from "@/lib/seo";
import { routes } from "@/lib/routes";
import { hrefFor, isExternalHref } from "@/lib/links";
import { AttachmentLink, RichText } from "@/components/sanity/RichText";
import { SanityImage, hasImage } from "@/components/sanity/SanityImage";
import { PersonCard } from "@/components/sections/PageSections";
import { Faq } from "@/components/ui/Faq";
import { Icon } from "@/components/ui/Icon";
import { Breadcrumbs, Button, Container, JsonLdScript, PageHeader, Section, TextLink } from "@/components/ui/primitives";
import { enquiryKind } from "@/lib/sacraments/kinds";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const [settings, s] = await Promise.all([getSettings(), getSacrament(slug, false)]);
  if (!s) return {};
  return buildMetadata({ settings, title: s.title, description: s.summary, path: routes.sacrament(slug), seo: s.seo, image: s.image });
}

export default async function SacramentPage({ params }: Props) {
  const { slug } = await params;
  const [settings, s] = await Promise.all([getSettings(), getSacrament(slug)]);
  if (!s) notFound();

  const downloads = (s.downloads ?? []).filter((d) => d.file?.asset?.url);
  const links = (s.links ?? [])
    .map((l) => ({ key: l._key, label: l.label, href: hrefFor(l) }))
    .filter((l): l is { key: string; label: string; href: string } => Boolean(l.href && l.label));
  const faq = (s.faq ?? []).filter((f) => f.question);

  const faqJsonLd: JsonLd | null = faq.length
    ? {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: faq.map((f) => ({
          "@type": "Question",
          name: f.question,
          acceptedAnswer: { "@type": "Answer", text: portableTextToPlain(f.answer) },
        })),
      }
    : null;

  return (
    <>
      <PageHeader
        title={s.title}
        lede={s.summary}
        eyebrow={<Breadcrumbs items={[{ label: "Zakramenti", href: routes.sacraments }, { label: s.title }]} />}
      />
      <Section>
        <Container className="grid gap-12 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:gap-16">
          <div>
            {hasImage(s.image) ? (
              <SanityImage image={s.image} aspect={3 / 2} sizes="(min-width: 1024px) 40rem, 100vw" maxWidth={1400} priority className="mb-10 overflow-hidden rounded-lg shadow-soft" imgClassName="saturate-[.7]" />
            ) : null}
            <RichText value={s.description} size="lg" />

            {s.steps?.length ? (
              <section className="mt-12">
                <h2 className="mb-6 text-[2rem] font-bold tracking-[-0.045em]">
                  Kako <span className="accent">poteka</span>
                </h2>
                <ol className="space-y-5">
                  {s.steps.map((step, i) => (
                    <li key={step._key} className="grid grid-cols-[2.5rem_1fr] gap-4">
                      <span className="flex size-9 items-center justify-center rounded-full bg-gold-soft text-body font-bold tabular-nums text-gold-ink" aria-hidden="true">
                        {i + 1}
                      </span>
                      <div className="pt-1">
                        <h3 className="text-[1.25rem] font-bold tracking-[-0.03em] text-ink">
                          <span className="sr-only">Korak {i + 1}: </span>
                          {step.title}
                        </h3>
                        <RichText value={step.text} className="mt-1 text-ink-2" />
                      </div>
                    </li>
                  ))}
                </ol>
              </section>
            ) : null}

            {faq.length ? (
              <section className="mt-12">
                <h2 className="mb-6 text-[2rem] font-bold tracking-[-0.045em]">
                  Pogosta <span className="accent">vprašanja</span>
                </h2>
                <Faq items={faq} />
              </section>
            ) : null}
          </div>

          <aside className="space-y-5">
            <div className="rounded-lg bg-[linear-gradient(165deg,var(--color-gold-soft)_0%,#fff_72%)] p-6 shadow-soft sm:p-8">
              <h2 className="text-h3">Se pripravljate?</h2>
              <p className="mt-2 text-body text-ink-2">Pošljite nam povpraševanje, oglasili se vam bomo.</p>
              <Button href={`/zakramenti/povprasevanje?vrsta=${enquiryKind(s.kind, slug)}`} className="mt-5">
                Pošlji povpraševanje
              </Button>
            </div>
            {s.contact || s.contactNote?.length ? (
              <div className="rounded-lg bg-surface p-6 shadow-soft sm:p-8">
                <h2 className="text-h3">Na koga se obrniti</h2>
                <RichText value={s.contactNote} className="mt-3 text-ink-2" />
                {s.contact ? (
                  <div className="mt-5 border-t border-stone/70 pt-5">
                    <PersonCard person={s.contact} />
                  </div>
                ) : null}
                <p className="mt-3">
                  <TextLink href={routes.contact}>Uradne ure župnišča</TextLink>
                </p>
              </div>
            ) : null}

            {s.requirements?.length ? (
              <div className="rounded-lg bg-surface p-6 shadow-soft sm:p-8">
                <h2 className="text-h3">Pogoji</h2>
                <ul className="mt-3 space-y-2">
                  {s.requirements.map((r) => (
                    <li key={r} className="flex gap-2 text-body text-ink-2">
                      <Icon name="check" size={18} className="mt-1 shrink-0 text-gold-ink" />
                      <span>{r}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {s.documentsNeeded?.length ? (
              <div className="rounded-lg bg-surface p-6 shadow-soft sm:p-8">
                <h2 className="text-h3">Kaj prinesti</h2>
                <ul className="mt-3 space-y-2">
                  {s.documentsNeeded.map((d) => (
                    <li key={d} className="flex gap-2 text-body text-ink-2">
                      <Icon name="document" size={18} className="mt-1 shrink-0 text-gold-ink" />
                      <span>{d}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {downloads.length ? (
              <div className="rounded-lg bg-surface p-6 shadow-soft sm:p-8">
                <h2 className="mb-4 text-h3">Obrazci</h2>
                <ul className="space-y-2">
                  {downloads.map((d) => (
                    <li key={d._id}>
                      <AttachmentLink attachment={{ title: d.title, file: d.file }} />
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {links.length ? (
              <div className="rounded-lg bg-surface p-6 shadow-soft sm:p-8">
                <h2 className="mb-2 text-h3">Koristne povezave</h2>
                <ul>
                  {links.map((l) => (
                    <li key={l.key}>
                      <TextLink href={l.href} external={isExternalHref(l.href)}>
                        {l.label}
                      </TextLink>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </aside>
        </Container>
      </Section>
      {faqJsonLd ? <JsonLdScript data={faqJsonLd} /> : null}
      <JsonLdScript data={breadcrumbJsonLd([{ name: "Zakramenti", path: routes.sacraments }, { name: s.title, path: routes.sacrament(slug) }], settings)} />
    </>
  );
}

/** Plain-text rendering of simple Portable Text for structured data. */
function portableTextToPlain(value: unknown): string {
  if (!Array.isArray(value)) return "";
  return value
    .map((block) => {
      const children = (block as { children?: { text?: string }[] }).children;
      return Array.isArray(children) ? children.map((c) => c.text ?? "").join("") : "";
    })
    .filter(Boolean)
    .join("\n");
}
