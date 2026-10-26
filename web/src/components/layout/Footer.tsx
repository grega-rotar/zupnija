import Link from "next/link";
import type { SETTINGS_QUERY_RESULT } from "@/sanity/types.generated";
import { routes } from "@/lib/routes";
import { telHref } from "@/lib/links";
import { WEEKDAY_LABEL, type Weekday, formatTime } from "@/lib/dates";
import { Container } from "@/components/ui/primitives";
import { Icon, type IconName } from "@/components/ui/Icon";
import { RichText } from "@/components/sanity/RichText";

const socialIcon: Record<string, IconName> = {
  facebook: "facebook",
  instagram: "instagram",
  youtube: "youtube",
  other: "link",
};

const columns = [
  {
    title: "Bogoslužje",
    links: [
      { label: "Svete maše", href: routes.masses },
      { label: "Mašni nameni", href: routes.intentions },
      { label: "Zakramenti", href: routes.sacraments },
      { label: "Verouk", href: routes.catechesis },
    ],
  },
  {
    title: "Dogajanje",
    links: [
      { label: "Oznanila", href: routes.announcements },
      { label: "Dogodki", href: routes.events },
      { label: "Novice", href: routes.news },
      { label: "Galerije", href: routes.galleries },
    ],
  },
  {
    title: "Župnija",
    links: [
      { label: "O župniji", href: routes.parish },
      { label: "Cerkve", href: routes.churches },
      { label: "Duhovniki in sodelavci", href: routes.people },
      { label: "Skupine", href: routes.groups },
      { label: "Dokumenti", href: routes.documents },
    ],
  },
];

export function Footer({ settings }: { settings: SETTINGS_QUERY_RESULT | null }) {
  const name = settings?.name || "Župnija Pirniče";
  const address = settings?.address;
  const addressLine = [address?.street, [address?.postalCode, address?.city].filter(Boolean).join(" ")]
    .filter(Boolean)
    .join(", ");
  const year = new Date().getFullYear();

  return (
    <footer className="mt-auto border-t border-stone bg-paper-2">
      <Container className="py-16 sm:py-20">
        <div className="mb-12 flex flex-wrap items-end justify-between gap-6 border-b border-stone pb-10 sm:mb-16">
          <p className="font-serif text-h1 text-ink">{name}</p>
          {settings?.diocese ? <p className="lede text-ink-3">{settings.diocese}</p> : null}
        </div>
        <div className="grid gap-10 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div>
            {settings?.tagline ? <p className="max-w-sm text-small text-ink-2">{settings.tagline}</p> : null}
            <address className="mt-5 space-y-1.5 not-italic text-small text-ink-2">
              {addressLine ? <p>{addressLine}</p> : null}
              {settings?.phone ? (
                <p>
                  <a href={telHref(settings.phone)} className="hover:text-ink hover:underline">
                    {settings.phone}
                  </a>
                </p>
              ) : null}
              {settings?.email ? (
                <p>
                  <a href={`mailto:${settings.email}`} className="hover:text-ink hover:underline">
                    {settings.email}
                  </a>
                </p>
              ) : null}
            </address>
            {settings?.officeHours?.length ? (
              <div className="mt-5">
                <p className="text-small font-medium text-ink">Uradne ure</p>
                <ul className="mt-1 space-y-0.5 text-small text-ink-2">
                  {settings.officeHours.map((h) => (
                    <li key={h._key}>
                      <span className="capitalize">{WEEKDAY_LABEL[h.weekday as Weekday] ?? h.weekday}</span>{" "}
                      <span className="tnum">
                        {formatTime(h.from)}–{formatTime(h.to)}
                      </span>
                      {h.note ? <span className="text-ink-3"> · {h.note}</span> : null}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {settings?.socialLinks?.length ? (
              <ul className="mt-5 flex gap-2">
                {settings.socialLinks.map((s) => (
                  <li key={s._key}>
                    <a
                      href={s.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex size-11 items-center justify-center rounded-sm text-ink-2 hover:bg-paper-3 hover:text-ink"
                    >
                      <Icon name={socialIcon[s.platform] ?? "link"} size={22} />
                      <span className="sr-only">{s.label || s.platform}</span>
                    </a>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>

          {columns.map((col) => (
            <nav key={col.title} aria-label={col.title}>
              <p className="text-small font-medium text-ink">{col.title}</p>
              <ul className="mt-2">
                {col.links.map((l) => (
                  <li key={l.href}>
                    <Link href={l.href} className="inline-flex min-h-10 items-center text-small text-ink-2 hover:text-ink hover:underline">
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        {settings?.footerText?.length ? (
          <RichText value={settings.footerText} size="sm" className="mt-10 text-ink-3 " />
        ) : null}

        <div className="mt-10 flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-t border-stone pt-6 text-meta text-ink-3">
          <p>
            © {year} {name}
          </p>
          <ul className="flex flex-wrap gap-x-5 gap-y-1">
            <li>
              <Link href={routes.contact} className="inline-flex min-h-8 items-center hover:text-ink hover:underline">
                Kontakt
              </Link>
            </li>
            {settings?.privacyPage?.slug ? (
              <li>
                <Link href={routes.page(settings.privacyPage.slug)} className="inline-flex min-h-8 items-center hover:text-ink hover:underline">
                  {settings.privacyPage.title || "Zasebnost"}
                </Link>
              </li>
            ) : null}
            {settings?.legalPage?.slug ? (
              <li>
                <Link href={routes.page(settings.legalPage.slug)} className="inline-flex min-h-8 items-center hover:text-ink hover:underline">
                  {settings.legalPage.title || "Pravne informacije"}
                </Link>
              </li>
            ) : null}
          </ul>
        </div>
      </Container>
    </footer>
  );
}
