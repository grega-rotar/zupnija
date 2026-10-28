import type { Metadata } from "next";
import { getSacraments, getSettings } from "@/sanity/data";
import { today } from "@/lib/clock";
import { emergencyContact } from "@/lib/forms/parish";
import { telHref } from "@/lib/links";
import { buildMetadata } from "@/lib/seo";
import { routes } from "@/lib/routes";
import { isSacramentKind } from "@/lib/sacraments/kinds";
import { AsideTile, FormPage } from "@/components/forms/FormPage";
import { SacramentForm } from "@/components/forms/SacramentForm";
import { TextLink } from "@/components/ui/primitives";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSettings();
  return buildMetadata({ settings, title: "Povpraševanje o zakramentih", description: "Krst, obhajilo, birma, poroka, bolniško maziljenje ali pogreb: pošljite povpraševanje župniji Pirniče.", path: "/zakramenti/povprasevanje" });
}

type Props = { searchParams: Promise<{ vrsta?: string | string[] }> };

/** A sacrament enquiry (US-008). `?vrsta=krst` preselects the kind (each sacrament page links here). */
export default async function SacramentEnquiryPage({ searchParams }: Props) {
  const { vrsta } = await searchParams;
  const v = Array.isArray(vrsta) ? vrsta[0] : vrsta;
  const [emergency, sacraments] = await Promise.all([emergencyContact(), getSacraments()]);
  const kind = isSacramentKind(v) ? v : "krst";

  return (
    <FormPage
      title="Povpraševanje o zakramentih"
      accent="zakramentih"
      lede="Pripravljate krst, poroko ali kaj drugega? Pišite nam, oglasili se vam bomo."
      crumbs={[{ label: "Zakramenti", href: routes.sacraments }, { label: "Povpraševanje" }]}
      eyebrow="Povpraševanje"
      heading={
        <>
          Kako vam lahko <span className="accent">pomagamo</span>
        </>
      }
      intro="Odgovorimo po telefonu ali e-pošti, običajno v nekaj dneh."
      aside={
        <>
          {emergency ? (
            <AsideTile eyebrow="Nujno" title={emergency.label} warm>
              <p>
                Ko gre za bolnika ali pogreb, ne čakajte na odgovor. Pokličite:{" "}
                <a href={telHref(emergency.phone)} className="whitespace-nowrap font-semibold text-gold-ink hover:underline">
                  {emergency.phone}
                </a>
              </p>
            </AsideTile>
          ) : null}
          {sacraments.length ? (
            <AsideTile title="O zakramentih">
              <ul className="space-y-1">
                {sacraments
                  .filter((s) => s.slug)
                  .map((s) => (
                    <li key={s._id}>
                      <TextLink href={routes.sacrament(s.slug!)}>{s.title}</TextLink>
                    </li>
                  ))}
              </ul>
            </AsideTile>
          ) : null}
        </>
      }
    >
      <SacramentForm key={kind} kind={kind} minDate={today()} emergency={emergency} />
    </FormPage>
  );
}

