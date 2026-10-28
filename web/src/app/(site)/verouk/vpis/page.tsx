import type { Metadata } from "next";
import { asc } from "drizzle-orm";
import { db, schema } from "@/db";
import { getCatechesis, getSettings } from "@/sanity/data";
import { buildMetadata } from "@/lib/seo";
import { routes } from "@/lib/routes";
import { closedMessage, isEnrolmentOpen, schoolYear, shortYear } from "@/lib/verouk/enrolment";
import { AsideTile, FormPage } from "@/components/forms/FormPage";
import { EnrolmentForm } from "@/components/forms/EnrolmentForm";
import { TextLink } from "@/components/ui/primitives";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSettings();
  return buildMetadata({ settings, title: "Vpis k verouku", description: "Spletni vpis otroka k verouku v župniji Pirniče.", path: "/verouk/vpis" });
}

/** Online Verouk enrolment (US-006). */
export default async function EnrolmentPage() {
  const g = schema.catechesisGroups;
  const [open, groups, { page }] = await Promise.all([
    isEnrolmentOpen(),
    db.select({ id: g.id, name: g.name }).from(g).orderBy(asc(g.position), asc(g.id)),
    getCatechesis(),
  ]);
  const sy = shortYear(schoolYear());
  const rules = (page?.documents ?? []).find((d) => /pravil/i.test(d.title ?? "") && d.file?.asset?.url);

  return (
    <FormPage
      title="Vpis k verouku"
      accent="verouku"
      lede={`Za šolsko leto ${sy}. Vpis vzame nekaj minut, potrdilo dobite po e-pošti.`}
      crumbs={[{ label: "Verouk", href: routes.catechesis }, { label: "Vpis" }]}
      eyebrow="Spletni vpis"
      heading={
        <>
          Podatki o <span className="accent">otroku</span>
        </>
      }
      intro="Za vsakega otroka oddajte svoj vpis. Polja brez oznake so obvezna."
      aside={
        <>
          <AsideTile eyebrow="Kako poteka" title="Po vpisu" warm>
            <p>Potrdilo s številko vpisa pošljemo na e-poštne naslove staršev. Katehist se vam oglasi pred prvim srečanjem.</p>
            <p>
              Urnik skupin je na strani <TextLink href={routes.catechesis}>Verouk</TextLink>.
            </p>
          </AsideTile>
          <AsideTile title="Imate vprašanje?">
            <p>
              Pokličite župnišče ali pišite prek <TextLink href={routes.contact}>kontaktnega obrazca</TextLink>.
            </p>
          </AsideTile>
        </>
      }
    >
      {open ? (
        <EnrolmentForm groups={groups} rulesHref={rules?.file?.asset?.url ?? null} />
      ) : (
        <div role="status" className="rounded-md bg-paper-2 p-5 text-body text-ink">
          {closedMessage()}
        </div>
      )}
    </FormPage>
  );
}
