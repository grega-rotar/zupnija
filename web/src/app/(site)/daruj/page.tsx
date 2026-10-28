import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getSettings } from "@/sanity/data";
import { getGiving } from "@/lib/giving/donations";
import { buildMetadata } from "@/lib/seo";
import { routes } from "@/lib/routes";
import { formatDate } from "@/lib/dates";
import { RichText } from "@/components/sanity/RichText";
import { BankDetails } from "@/components/giving/BankDetails";
import { QrCard } from "@/components/giving/UpnQr";
import { CopyButton } from "@/components/share/CopyButton";
import { Breadcrumbs, Container, PageHeader, Section, SectionHeading, tile } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSettings();
  return buildMetadata({
    settings,
    title: "Darovi",
    description: "Podprite župnijo: UPN QR koda za bančno aplikacijo in podatki za nakazilo.",
    path: routes.donate,
  });
}

const euro = new Intl.NumberFormat("sl-SI", { style: "currency", currency: "EUR", maximumFractionDigits: 2, minimumFractionDigits: 0 });

/**
 * /daruj (US-009): the parish's UPN QR and bank details from Nastavitve →
 * Darovi, then one QR per "Namen darovanja" with its own amount. The
 * design is the "Podprite župnijo" tile of tasks/proto-v4/partials/c.html.
 * Without an IBAN the page does not exist.
 */
export default async function GivingPage() {
  const giving = await getGiving();
  if (!giving) notFound();

  return (
    <>
      <PageHeader
        title="Podprite župnijo"
        accent="župnijo"
        lede="Skenirajte kodo v bančni aplikaciji. Vaš dar pomaga pri skrbi za cerkve in življenje župnije."
        eyebrow={<Breadcrumbs items={[{ label: "Domov", href: routes.home }, { label: "Darovi" }]} />}
      />

      <Section>
        <Container>
          <div className={cn(tile, "mx-auto flex max-w-[52rem] flex-col-reverse gap-8 p-7 sm:p-11 md:flex-row md:items-center md:gap-10")}>
            <div className="flex min-w-0 flex-1 flex-col self-stretch">
              <p className="text-[13px] font-semibold tracking-[-0.005em] text-ink-3">Darovi</p>
              <h2 className="mt-2.5 text-[1.75rem] font-bold leading-[1.08] tracking-[-0.04em] text-balance sm:text-[2rem]">
                Dar z <em className="accent">UPN QR</em>
              </h2>
              {giving.intro?.length ? (
                <RichText value={giving.intro} className="mt-3 text-ink-2" />
              ) : (
                <p className="mt-3 max-w-[22.5rem] text-[1.0625rem] leading-normal text-ink-2">
                  V bančni aplikaciji izberite »Plačaj s QR« in skenirajte kodo. Znesek vpišete sami.
                </p>
              )}
              <BankDetails giving={giving} className="mt-5" />
              <div className="mt-5">
                <CopyButton text={giving.iban} label="Kopiraj IBAN" done="IBAN je kopiran." />
              </div>
            </div>
            <QrCard payload={giving.payload} className="self-center" />
          </div>
        </Container>
      </Section>

      {giving.purposes.length ? (
        <Section aria-labelledby="nameni-h">
          <Container>
            <SectionHeading id="nameni-h" eyebrow="Nameni" title="Darujte za poseben namen" accent="poseben namen" lede="Vsaka koda ima že vpisan namen in znesek. Znesek lahko v aplikaciji spremenite." />
            <ul className={cn("mx-auto grid gap-5", giving.purposes.length > 1 ? "md:grid-cols-2" : "max-w-[40rem]")}>
              {giving.purposes.map((p) => (
                <li key={p.id} className={cn(tile, "flex flex-col-reverse gap-6 p-7 sm:flex-row sm:items-center sm:p-9")}>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-[1.5rem] font-bold leading-tight tracking-[-0.035em]">{p.title}</h3>
                    {p.amount ? <p className="tnum mt-1.5 text-[1.0625rem] font-semibold text-gold-ink">{euro.format(p.amount)}</p> : null}
                    {p.description ? <p className="mt-3 text-ink-2">{p.description}</p> : null}
                    <p className="mt-3 text-small text-ink-3">
                      Namen: {p.purpose}
                      {p.until ? <span className="whitespace-nowrap"> · do {formatDate(p.until)}</span> : null}
                    </p>
                  </div>
                  <QrCard payload={p.payload} label={`UPN QR koda: ${p.title}${p.amount ? `, ${euro.format(p.amount)}` : ""}`} className="w-[10.5rem] self-center" />
                </li>
              ))}
            </ul>
          </Container>
        </Section>
      ) : null}
    </>
  );
}
