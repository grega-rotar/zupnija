import type { Metadata } from "next";
import { asc } from "drizzle-orm";
import { db, schema } from "@/db";
import { getSettings } from "@/sanity/data";
import { today } from "@/lib/clock";
import { telHref } from "@/lib/links";
import { buildMetadata } from "@/lib/seo";
import { routes } from "@/lib/routes";
import { AsideTile, FormPage } from "@/components/forms/FormPage";
import { IntentionRequestForm } from "@/components/forms/IntentionRequestForm";
import { TextLink } from "@/components/ui/primitives";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSettings();
  return buildMetadata({ settings, title: "Prošnja za mašni namen", description: "Prosite za mašni namen v župniji Pirniče.", path: "/masni-nameni/prosnja" });
}

/** Ask for a Mass intention online (US-007). Honest copy: it is a request, not a booking; no payment online. */
export default async function IntentionRequestPage() {
  const c = schema.churches;
  const [settings, churches] = await Promise.all([getSettings(), db.select({ slug: c.slug, name: c.shortName }).from(c).orderBy(asc(c.position))]);

  return (
    <FormPage
      title="Prošnja za mašni namen"
      accent="mašni namen"
      lede="Napišite, za koga naj se daruje maša. Župnik vas bo poklical ali vam pisal."
      crumbs={[{ label: "Mašni nameni", href: routes.intentions }, { label: "Prošnja" }]}
      eyebrow="Prošnja"
      heading={
        <>
          Za koga naj se <span className="accent">daruje</span>
        </>
      }
      intro="Prošnja še ni potrjen namen. Župnik vas bo poklical ali vam pisal. Dar za mašo prinesete v župnišče."
      aside={
        <>
          <AsideTile eyebrow="Dobro je vedeti" title="Kako poteka" warm>
            <p>Župnik pogleda, kateri dnevi so še prosti, in se z vami dogovori za dan in uro.</p>
            <p>Namen je na strani Mašni nameni, ko je vpisan. Na spletu ne plačujete ničesar.</p>
          </AsideTile>
          <AsideTile title="Raje osebno?">
            <p>
              Namen lahko naročite tudi v župnišču v uradnih urah
              {settings?.phone ? (
                <>
                  {" "}ali po telefonu{" "}
                  <a href={telHref(settings.phone)} className="font-medium text-gold-ink hover:underline">
                    {settings.phone}
                  </a>
                </>
              ) : null}
              .
            </p>
            <p>
              <TextLink href={routes.intentions}>Mašni nameni ta teden</TextLink>
            </p>
          </AsideTile>
        </>
      }
    >
      <IntentionRequestForm churches={churches} minDate={today()} />
    </FormPage>
  );
}
