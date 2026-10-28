import type { Metadata } from "next";
import Link from "next/link";
import { getActiveSpecialPeriod, getChurchesBrief, getHomePage, getSettings } from "@/sanity/data";
import { buildMetadata } from "@/lib/seo";
import { routes } from "@/lib/routes";
import { WEEKDAY_LABEL, formatTime, type Weekday } from "@/lib/dates";
import { telHref } from "@/lib/links";
import { clean } from "@/lib/clean";
import { PageHero } from "@/components/layout/PageHero";
import { ContactForm } from "@/components/forms/ContactForm";
import { RichText } from "@/components/sanity/RichText";
import { SanityImage, hasImage } from "@/components/sanity/SanityImage";
import { Icon, type IconName } from "@/components/ui/Icon";
import { Container, Section, TextLink } from "@/components/ui/primitives";
import { BankDetails } from "@/components/giving/BankDetails";
import { getGiving } from "@/lib/giving/donations";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSettings();
  return buildMetadata({
    settings,
    title: "Kontakt",
    description: "Naslov, telefon, e-pošta in uradne ure župnišča Pirniče.",
    path: routes.contact,
  });
}

export default async function ContactPage() {
  const [settings, period, churches, home] = await Promise.all([getSettings(), getActiveSpecialPeriod(), getChurchesBrief(), getHomePage()]);
  const address = settings?.address;
  const addressLine = [address?.street, [address?.postalCode, address?.city].filter(Boolean).join(" ")].filter(Boolean).join(", ");
  const mapsHref = addressLine ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addressLine)}` : null;
  const donations = settings?.donations;
  const giving = await getGiving();
  const hasDonations = Boolean(donations?.iban || donations?.intro?.length);
  const pastor = settings?.pastor;

  return (
    <>
      <PageHero settings={settings} header="contactHeader" title="Stopimo v stik" accent="v stik" crumbs={[{ label: "Kontakt" }]} lede="Veseli bomo vašega sporočila." />

      <Section>
        <Container>
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)_minmax(0,1fr)]">
            <div className="rounded-lg bg-surface p-6 shadow-soft sm:p-8">
              <p className="eyebrow">Župnišče</p>
              <h2 className="mt-1 text-[1.5rem] font-bold tracking-[-0.035em]">Kontaktni podatki</h2>
              <ul className="mt-5 space-y-5">
                {addressLine ? (
                  <Row icon="pin" label={settings?.name ?? "Župnišče"}>
                    {mapsHref ? (
                      <a href={mapsHref} target="_blank" rel="noopener noreferrer" className="hover:underline">
                        {addressLine}
                      </a>
                    ) : (
                      addressLine
                    )}
                  </Row>
                ) : null}
                {settings?.phone || settings?.mobile ? (
                  <Row icon="phone" label="Telefon">
                    {settings.phone ? (
                      <a href={telHref(settings.phone)} className="hover:underline">
                        {settings.phone}
                      </a>
                    ) : null}
                    {settings.phone && settings.mobile ? <br /> : null}
                    {settings.mobile ? (
                      <a href={telHref(settings.mobile)} className="hover:underline">
                        {settings.mobile}
                      </a>
                    ) : null}
                  </Row>
                ) : null}
                {settings?.email ? (
                  <Row icon="mail" label="E-pošta">
                    <a href={`mailto:${settings.email}`} className="break-all hover:underline">
                      {settings.email}
                    </a>
                  </Row>
                ) : null}
                <Row icon="clock" label="Uradne ure">
                  {period?.officeHoursNote ? <span className="block font-medium text-ink">{period.officeHoursNote}</span> : null}
                  {settings?.officeHours?.length ? (
                    <ul className="space-y-0.5">
                      {settings.officeHours.map((h) => (
                        <li key={h._key}>
                          <span className="capitalize">{WEEKDAY_LABEL[clean(h.weekday) as Weekday] ?? h.weekday}</span>{" "}
                          <span className="tnum">
                            {formatTime(h.from)}–{formatTime(h.to)}
                          </span>
                          {h.note ? <span className="text-ink-3"> · {h.note}</span> : null}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    "po dogovoru"
                  )}
                  {settings?.officeHoursNote?.length ? <RichText value={settings.officeHoursNote} size="sm" className="mt-1 text-ink-3" /> : null}
                </Row>
                {settings?.emergencyContact?.phone ? (
                  <Row icon="alert" label={settings.emergencyContact.label || "Nujni primeri"}>
                    <a href={telHref(settings.emergencyContact.phone)} className="font-medium hover:underline">
                      {settings.emergencyContact.phone}
                    </a>
                  </Row>
                ) : null}
              </ul>
              {pastor ? (
                <div className="mt-6 flex items-center gap-4 border-t border-stone/70 pt-5">
                  {hasImage(pastor.photo) ? (
                    <SanityImage image={pastor.photo} aspect={1} sizes="3.5rem" maxWidth={160} className="size-14 shrink-0 rounded-full" />
                  ) : null}
                  <div>
                    <p className="font-semibold text-ink">{pastor.name}</p>
                    <p className="text-small text-ink-2">{pastor.roleTitle || "Župnik"}</p>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="rounded-lg bg-surface p-6 shadow-soft sm:p-8">
              <p className="eyebrow">Obrazec</p>
              <h2 className="mt-1 text-[1.5rem] font-bold tracking-[-0.035em]">
                Pošljite nam <span className="accent">sporočilo</span>
              </h2>
              <p className="mt-1.5 text-small text-ink-2">Za dogovore o zakramentih se raje oglasite osebno; za vprašanja in predloge je obrazec dovolj.</p>
              <div className="mt-5">
                <ContactForm />
              </div>
            </div>

            <figure className="relative isolate min-h-[20rem] overflow-hidden rounded-lg bg-paper-3 text-paper shadow-soft">
              {hasImage(home?.tile?.image) ? (
                <SanityImage
                  image={home.tile.image}
                  aspect={3 / 4}
                  sizes="(min-width: 1024px) 20rem, 100vw"
                  maxWidth={900}
                  decorative
                  fill
                  className="-z-20"
                  imgClassName="[filter:saturate(.5)_sepia(.15)]"
                />
              ) : null}
              <div aria-hidden="true" className="absolute inset-0 -z-10 bg-[linear-gradient(180deg,rgb(14_10_6/0.05)_30%,rgb(14_10_6/0.75)_100%)]" />
              <figcaption className="absolute inset-x-0 bottom-0 p-6 sm:p-8">
                <p className="font-serif text-[1.5rem] italic leading-snug">{home?.tile?.text ?? settings?.tagline ?? ""}</p>
                {home?.tile?.source ? <p className="mt-2 text-small font-semibold text-paper/85">{home.tile.source}</p> : null}
              </figcaption>
            </figure>
          </div>
        </Container>
      </Section>

      {churches.length || hasDonations ? (
        <Section>
          <Container className="grid gap-5 lg:grid-cols-2">
            {churches.length ? (
              <div className="rounded-lg bg-surface p-6 shadow-soft sm:p-8">
                <p className="eyebrow">Kje smo</p>
                <h2 className="mt-1 text-[1.5rem] font-bold tracking-[-0.035em]">Cerkve</h2>
                <ul className="mt-4 divide-y divide-stone/70">
                  {churches.map((c) => {
                    const line = [c.address?.street, c.address?.city].filter(Boolean).join(", ");
                    return (
                      <li key={c._id} className="flex items-center gap-4 py-3">
                        {hasImage(c.image) ? (
                          <SanityImage image={c.image} aspect={1} sizes="3.5rem" maxWidth={160} decorative className="size-14 shrink-0 overflow-hidden rounded-[0.875rem]" imgClassName="saturate-[.6]" />
                        ) : null}
                        <div className="min-w-0">
                          <Link href={routes.church(c.slug)} className="rounded-sm text-body font-semibold text-ink hover:text-gold-ink">
                            {c.name}
                          </Link>
                          {line ? <p className="text-small text-ink-2">{line}</p> : null}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : null}
            {hasDonations ? (
              <div className="rounded-lg bg-[linear-gradient(165deg,var(--color-gold-soft)_0%,#fff_72%)] p-6 shadow-soft sm:p-8">
                <p className="eyebrow">Podprite župnijo</p>
                <h2 className="mt-1 text-[1.5rem] font-bold tracking-[-0.035em]">Darovi za župnijo</h2>
                <RichText value={donations?.intro} className="mt-3 text-ink-2" />
                {giving ? (
                  <>
                    <BankDetails giving={giving} className="mt-3" />
                    <TextLink href={routes.donate} className="mt-4">
                      UPN QR koda in nameni darovanja
                    </TextLink>
                  </>
                ) : null}
              </div>
            ) : null}
          </Container>
        </Section>
      ) : null}
    </>
  );
}

function Row({ icon, label, children }: { icon: IconName; label: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-3.5">
      <Icon name={icon} size={20} className="mt-0.5 shrink-0 text-gold-ink" />
      <div className="min-w-0 text-body text-ink-2">
        <p className="font-semibold text-ink">{label}</p>
        <div>{children}</div>
      </div>
    </li>
  );
}
