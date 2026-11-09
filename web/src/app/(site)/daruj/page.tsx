import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getSettings } from "@/sanity/data";
import { getGiving } from "@/lib/giving/donations";
import { buildMetadata } from "@/lib/seo";
import { routes } from "@/lib/routes";
import { formatDate } from "@/lib/dates";
import { RichText } from "@/components/sanity/RichText";
import { QrCard } from "@/components/giving/UpnQr";
import { UpnSlip } from "@/components/giving/UpnSlip";
import { Container, PageHeader, Section, SectionHeading, tile } from "@/components/ui/primitives";
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
 * /daruj (US-009): the parish's filled-in UPN with its QR from Nastavitve →
 * Darovi (the same card as the homepage's "Podprite župnijo", ZUP-17), then
 * one QR per "Namen darovanja" with its own amount.
 * Without an IBAN the page does not exist.
 */
export default async function GivingPage() {
  const giving = await getGiving();
  if (!giving) notFound();

  return (
    <>
      <PageHeader
        title="Podprite župnijo" crumbs={[{ label: "Darovi" }]}
      />

      <Section>
        <Container>
          <div className="mx-auto max-w-[62rem]">
            <UpnSlip giving={giving} headingLevel="h2" />
            <div className="mx-auto mt-8 max-w-[42rem] text-center text-ink-2">
              {giving.intro?.length ? (
                <RichText value={giving.intro} />
              ) : (
                <p className="text-[1.0625rem] leading-normal">V bančni aplikaciji izberite »Plačaj s QR« in skenirajte kodo. Znesek vpišete sami.</p>
              )}
              {giving.bic ? <p className="tnum mt-2 text-small text-ink-3">BIC banke prejemnika: {giving.bic}</p> : null}
            </div>
          </div>
        </Container>
      </Section>

      {giving.purposes.length ? (
        <Section aria-labelledby="nameni-h">
          <Container>
            <SectionHeading id="nameni-h" title="Darujte za poseben namen" lede="Vsaka koda ima že vpisan namen in znesek. Znesek lahko v aplikaciji spremenite." />
            <ul className={cn("mx-auto grid gap-5", giving.purposes.length > 1 ? "md:grid-cols-2" : "max-w-[40rem]")}>
              {giving.purposes.map((p) => (
                <li key={p.id} className={cn(tile, "flex flex-col-reverse gap-6 p-7 sm:flex-row sm:items-center sm:p-9")}>
                  <div className="min-w-0 flex-1">
                    <h3>{p.title}</h3>
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
