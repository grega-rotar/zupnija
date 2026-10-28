import type { Metadata } from "next";
import Link from "next/link";
import { getSacraments, getSettings } from "@/sanity/data";
import { buildMetadata } from "@/lib/seo";
import { routes } from "@/lib/routes";
import { clean } from "@/lib/clean";
import { SACRAMENT_KIND_LABEL } from "@/lib/labels";
import { SanityImage, hasImage } from "@/components/sanity/SanityImage";
import { Container, EmptyState, PageHeader, Section, TextLink, tile, tileHover } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSettings();
  return buildMetadata({
    settings,
    title: "Zakramenti",
    description: "Krst, prvo sveto obhajilo, birma, poroka, spoved, bolniško maziljenje in pogreb v župniji Pirniče: kako se dogovoriti in kaj potrebujete.",
    path: routes.sacraments,
  });
}

export default async function SacramentsPage() {
  const sacraments = await getSacraments();
  return (
    <>
      <PageHeader title="Sveti zakramenti" accent="zakramenti" eyebrow={<p className="eyebrow">Krst, poroka, pogreb</p>} lede="Kako se dogovoriti za krst, poroko, pogreb in druge zakramente, kaj prinesti in na koga se obrniti." />
      <Section>
        <Container>
          {sacraments.length ? (
            <ul className="grid gap-5 md:grid-cols-2">
              {sacraments.map((s) => (
                <li key={s._id}>
                  <Link href={routes.sacrament(s.slug)} className={cn(tile, tileHover, "group flex h-full items-center gap-5 p-5 no-underline sm:p-6")}>
                    {hasImage(s.image) ? (
                      <SanityImage image={s.image} aspect={1} sizes="5.5rem" maxWidth={220} decorative className="size-[5.5rem] shrink-0 overflow-hidden rounded-md" imgClassName="saturate-[.7]" />
                    ) : (
                      <div className="flex size-[5.5rem] shrink-0 items-center justify-center rounded-md bg-gold-soft text-gold-ink" aria-hidden="true">
                        <svg width="22" height="26" viewBox="0 0 22 26"><path d="M11 2v22M3 9h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="eyebrow">{SACRAMENT_KIND_LABEL[clean(s.kind)] ?? "Zakrament"}</p>
                      <h2 className="mt-1 text-[1.375rem] font-bold leading-snug tracking-[-0.035em] text-ink">{s.title}</h2>
                      {s.summary ? <p className="mt-1 text-small text-ink-2">{s.summary}</p> : null}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="Informacije o zakramentih še niso vpisane" text="Za dogovor pokličite župnišče." action={{ label: "Kontakt", href: routes.contact }} />
          )}
          <p className="mt-10 flex flex-col items-center gap-1 text-center text-body text-ink-2">
            Za vse zakramente se osebno dogovorite v župnišču. <TextLink href={routes.contact}>Uradne ure in kontakt</TextLink>
          </p>
        </Container>
      </Section>
    </>
  );
}
