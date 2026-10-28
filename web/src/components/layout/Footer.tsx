import Link from "next/link";
import type { SETTINGS_QUERY_RESULT } from "@/sanity/types.generated";
import { routes } from "@/lib/routes";
import { telHref } from "@/lib/links";
import { today } from "@/lib/clock";
import { hozanaUrl } from "@/lib/liturgy/hozana";
import { WEEKDAY_LABEL, type Weekday, formatTime } from "@/lib/dates";

const more = [
  { label: "Svete maše", href: routes.masses },
  { label: "Mašni nameni", href: routes.intentions },
  { label: "Novice", href: routes.news },
  { label: "Dokumenti", href: routes.documents },
];

const link = "underline-offset-4 hover:text-ink hover:underline";

/**
 * Quiet footer (tasks/proto-v4/partials/c.html): brand and "Daruj", then
 * four columns (the parish, office hours, contact, more) and a legal line.
 */
export function Footer({ settings }: { settings: SETTINGS_QUERY_RESULT | null }) {
  const name = settings?.name || "Župnija Pirniče";
  const address = settings?.address;
  const lines = [address?.street, [address?.postalCode, address?.city].filter(Boolean).join(" ")].filter(Boolean);
  const year = today().slice(0, 4);

  return (
    <footer className="mx-auto mt-auto w-full max-w-[1240px] px-6 pb-16 pt-24 text-[14px] leading-[1.6] text-ink-3 md:pt-40">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[rgb(14_14_16/0.07)] pb-7">
        <Link href={routes.home} className="inline-flex min-h-11 items-center gap-2.5 text-[17px] font-bold tracking-[-0.025em] text-ink">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <path d="M12 2.5v19M6 8h12" />
          </svg>
          {name}
          <em className="accent ml-0.5 hidden text-[19px] text-ink-3 md:inline">pod Šmarno goro</em>
        </Link>
        <Link
          href={`${routes.home}#darovi`}
          className="inline-flex h-11 items-center rounded-full bg-moss px-5 text-[15px] font-semibold text-white transition-[transform,background-color] duration-200 hover:scale-[1.03] hover:bg-[#8d6b25] motion-reduce:hover:scale-100"
        >
          Daruj
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-x-6 gap-y-7 py-8 md:grid-cols-4">
        <div>
          <h2 className="mb-2 text-[13px] font-semibold tracking-[-0.005em] text-ink">{name}</h2>
          <address className="not-italic">
            {lines.map((l) => (
              <p key={l}>{l}</p>
            ))}
            {settings?.diocese ? <p>{settings.diocese}</p> : null}
          </address>
        </div>
        <div>
          <h2 className="mb-2 text-[13px] font-semibold tracking-[-0.005em] text-ink">Uradne ure</h2>
          {settings?.officeHours?.length ? (
            <ul className="grid gap-1">
              {settings.officeHours.map((h) => (
                <li key={h._key}>
                  <span className="capitalize">{WEEKDAY_LABEL[h.weekday as Weekday] ?? h.weekday}</span>{" "}
                  <span className="tnum">
                    {formatTime(h.from)}–{formatTime(h.to)}
                  </span>
                  {h.note ? <span> · {h.note}</span> : null}
                </li>
              ))}
            </ul>
          ) : (
            <p>
              <Link href={routes.contact} className={link}>
                Po dogovoru
              </Link>
            </p>
          )}
        </div>
        <div>
          <h2 className="mb-2 text-[13px] font-semibold tracking-[-0.005em] text-ink">Kontakt</h2>
          <ul className="grid gap-1">
            {settings?.email ? (
              <li>
                <a href={`mailto:${settings.email}`} className={link}>
                  {settings.email}
                </a>
              </li>
            ) : null}
            {settings?.phone ? (
              <li>
                <a href={telHref(settings.phone)} className={link}>
                  {settings.phone}
                </a>
              </li>
            ) : null}
            {settings?.socialLinks?.map((x) => (
              <li key={x._key}>
                <a href={x.url} target="_blank" rel="noopener noreferrer" className={link}>
                  {x.label || x.platform.charAt(0).toUpperCase() + x.platform.slice(1)}
                </a>
              </li>
            ))}
          </ul>
        </div>
        <nav aria-label="Več">
          <h2 className="mb-2 text-[13px] font-semibold tracking-[-0.005em] text-ink">Več</h2>
          <ul className="grid gap-1">
            <li>
              <a href={hozanaUrl(today())} target="_blank" rel="noopener noreferrer" className={link}>
                Berila dneva
              </a>
            </li>
            {more.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className={link}>
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>

      <div className="flex flex-wrap justify-between gap-3 border-t border-[rgb(14_14_16/0.07)] pt-5 text-[12px]">
        <span>
          © {year} {name}
        </span>
        <ul className="flex flex-wrap gap-x-5 gap-y-1">
          {settings?.privacyPage?.slug ? (
            <li>
              <Link href={routes.page(settings.privacyPage.slug)} className={link}>
                {settings.privacyPage.title || "Zasebnost"}
              </Link>
            </li>
          ) : null}
          {settings?.legalPage?.slug ? (
            <li>
              <Link href={routes.page(settings.legalPage.slug)} className={link}>
                {settings.legalPage.title || "Pravne informacije"}
              </Link>
            </li>
          ) : null}
          <li>Marijina cerkev · Sv. Križ · Sv. Tomaž</li>
        </ul>
      </div>
    </footer>
  );
}
