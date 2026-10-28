import type { Metadata } from "next";
import Link from "next/link";
import { getCurrentAnnouncements, getHomePage, getSettings } from "@/sanity/data";
import { bulletinLabel, getBulletinList, getCurrentBulletin } from "@/lib/data/bulletins";
import { getUpcomingEvents } from "@/lib/data/events";
import { getMassDays } from "@/lib/data/masses";
import { buildMetadata } from "@/lib/seo";
import { routes } from "@/lib/routes";
import { addDays, dateOf, formatDate, formatDayNumber, formatMonthShort, formatTime, formatWeekSpan, startOfWeek, timeOf } from "@/lib/dates";
import { today } from "@/lib/clock";
import { clean } from "@/lib/clean";
import { ANNOUNCEMENT_CATEGORY_LABEL } from "@/lib/labels";
import { hrefFor, isExternalHref } from "@/lib/links";
import { cn } from "@/lib/utils";
import { PageHero } from "@/components/layout/PageHero";
import { BulletinView } from "@/components/announcements/BulletinView";
import { SanityImage, hasImage } from "@/components/sanity/SanityImage";
import { Icon } from "@/components/ui/Icon";
import { Container, EmptyState, Section, Tag, TextLink } from "@/components/ui/primitives";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSettings();
  return buildMetadata({
    settings,
    title: "Oznanila",
    description: "Aktualna oznanila in mesečna oznanila župnije Pirniče: obvestila, srečanja, mašni nameni.",
    path: routes.announcements,
  });
}

const FILTERS = [
  { key: "", label: "Vsa oznanila" },
  { key: "pastoral", label: "Pastoralna obvestila" },
  { key: "special", label: "Prazniki in posebni termini" },
  { key: "catechesis", label: "Verouk" },
  { key: "caritas", label: "Karitas" },
] as const;

type Props = { searchParams: Promise<{ vrsta?: string }> };

export default async function AnnouncementsPage({ searchParams }: Props) {
  const { vrsta = "" } = await searchParams;
  const [settings, announcements, bulletin, list, events, home] = await Promise.all([
    getSettings(),
    getCurrentAnnouncements(),
    getCurrentBulletin(),
    getBulletinList(),
    getUpcomingEvents(3),
    getHomePage(),
  ]);
  // Beside the bulletin: this week's Masses while the bulletin runs, else its first week.
  const t = today();
  const week = bulletin ? startOfWeek(t >= bulletin.periodStart && t <= bulletin.periodEnd ? t : bulletin.periodStart) : null;
  const massDays = week ? await getMassDays(week, addDays(week, 6)) : [];
  const massHeading = week ? (week === startOfWeek(t) ? "Ta teden" : formatWeekSpan(week, addDays(week, 6))) : undefined;

  const usedCategories = new Set(announcements.map((a) => clean(a.category) ?? "notice"));
  const filters = FILTERS.filter((f) => !f.key || usedCategories.has(f.key));
  const filter = filters.some((f) => f.key === vrsta) ? vrsta : "";
  const shown = filter ? announcements.filter((a) => clean(a.category) === filter) : announcements;

  const olderBulletins = list.filter((b) => b.id !== bulletin?.id).slice(0, 5);

  return (
    <>
      <PageHero settings={settings} header="announcementsHeader" title="Oznanila župnije" accent="župnije" crumbs={[{ label: "Oznanila" }]} lede="Kar je trenutno pomembno v župniji." />

      <Section>
        <Container>
          <div className="grid gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <div>
              {/* Filters */}
              <nav aria-label="Vrsta oznanil" className="-mx-6 mb-5 flex gap-2 overflow-x-auto px-6 py-1 no-scrollbar sm:mx-0 sm:px-0">
                {filters.map((f) => (
                  <Link
                    key={f.key}
                    href={f.key ? `${routes.announcements}?vrsta=${f.key}` : routes.announcements}
                    aria-current={f.key === filter ? "true" : undefined}
                    className={cn(
                      "inline-flex min-h-11 shrink-0 items-center rounded-full px-5 text-[0.9375rem] font-semibold transition-colors",
                      f.key === filter ? "bg-moss text-paper" : "bg-surface text-ink shadow-soft hover:bg-paper-2",
                    )}
                  >
                    {f.label}
                  </Link>
                ))}
              </nav>

              {shown.length ? (
                <ul className="space-y-5">
                  {shown.map((a) => {
                    const category = clean(a.category) ?? "notice";
                    const importance = clean(a.importance);
                    const ctaHref = hrefFor(a.cta);
                    return (
                      <li key={a._id} className="overflow-hidden rounded-lg bg-surface shadow-soft">
                        <article className={cn("grid gap-5 p-5 sm:gap-7 sm:p-7", hasImage(a.image) && "sm:grid-cols-[15rem_1fr]")}>
                          {hasImage(a.image) ? (
                            <Link href={routes.announcement(a.slug)} className="block" tabIndex={-1} aria-hidden="true">
                              <SanityImage image={a.image} aspect={4 / 3} sizes="(min-width: 640px) 16rem, 100vw" maxWidth={800} decorative className="overflow-hidden rounded-md" imgClassName="saturate-[.7]" />
                            </Link>
                          ) : null}
                          <div className="flex min-w-0 flex-col">
                            <div className="flex flex-wrap items-center gap-2">
                              <Tag tone={importance === "urgent" ? "alert" : importance === "important" ? "gold" : "neutral"}>
                                {importance === "urgent" ? "Nujno" : ANNOUNCEMENT_CATEGORY_LABEL[category] ?? "Obvestilo"}
                              </Tag>
                              {a.hasAttachments ? (
                                <span className="inline-flex items-center gap-1 text-meta text-ink-3">
                                  <Icon name="document" size={14} /> priponka
                                </span>
                              ) : null}
                            </div>
                            <h2 className="mt-3 text-[1.5rem] font-bold leading-tight tracking-[-0.035em] text-ink sm:text-[1.75rem]">
                              <Link href={routes.announcement(a.slug)} className="rounded-sm hover:text-gold-ink">
                                {a.title}
                              </Link>
                            </h2>
                            <p className="mt-2 flex flex-wrap items-center gap-1.5 text-small font-medium text-ink-3">
                              <Icon name="calendar" size={15} className="text-gold-ink" />
                              <time dateTime={a.publishFrom}>{formatDate(dateOf(a.publishFrom))}</time>
                              {a.publishUntil ? <span>· velja do {formatDate(dateOf(a.publishUntil))}</span> : null}
                            </p>
                            {a.summary ? <p className="mt-3 text-body text-ink-2">{a.summary}</p> : null}
                            <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1">
                              <Link href={routes.announcement(a.slug)} className="group/m inline-flex min-h-10 items-center gap-1.5 text-[0.9375rem] font-semibold text-gold-ink hover:text-moss-deep">
                                Preberi več <Icon name="arrow-right" size={14} className="transition-transform group-hover/m:translate-x-[3px]" />
                              </Link>
                              {ctaHref && a.cta?.label ? (
                                <a
                                  href={ctaHref}
                                  target={isExternalHref(ctaHref) ? "_blank" : undefined}
                                  rel={isExternalHref(ctaHref) ? "noopener noreferrer" : undefined}
                                  className="inline-flex min-h-10 items-center gap-1.5 text-[0.9375rem] font-semibold text-gold-ink hover:text-moss-deep"
                                >
                                  {a.cta.label} <Icon name={isExternalHref(ctaHref) ? "external" : "arrow-right"} size={14} />
                                </a>
                              ) : null}
                            </div>
                          </div>
                        </article>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <EmptyState title="Ni oznanil" text="Trenutno ni aktualnih oznanil te vrste." action={{ label: "Arhiv oznanil", href: routes.announcementsArchive }} />
              )}

              <p className="mt-6 text-center">
                <TextLink href={routes.announcementsArchive}>Arhiv oznanil</TextLink>
              </p>
            </div>

            {/* Sidebar */}
            <aside className="space-y-5 lg:pt-[3.75rem]">
              <section aria-labelledby="oznanila-zupnije" className="rounded-lg bg-[linear-gradient(165deg,var(--color-gold-soft)_0%,#fff_72%)] p-6 shadow-soft sm:p-8">
                <h2 id="oznanila-zupnije" className="eyebrow flex items-center gap-2">
                  <Icon name="document" size={16} className="shrink-0" />
                  Oznanila župnije
                </h2>
                {bulletin ? (
                  <>
                    <p className="mt-3 text-[2.25rem] font-bold leading-none tracking-[-0.045em] text-ink">{bulletinLabel(bulletin)}</p>
                    {bulletin.issue ? <p className="mt-1 text-small text-ink-3">{bulletin.issue}</p> : null}
                  </>
                ) : (
                  <p className="mt-4 text-body text-ink-2">Oznanila izidejo na začetku meseca.</p>
                )}
                {bulletin ? (
                  <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1">
                    <a href="#mesecna" className="inline-flex min-h-10 items-center gap-2 text-[0.9375rem] font-semibold text-gold-ink hover:text-moss-deep">
                      Preberi na tej strani
                    </a>
                    {bulletin.pdfUrl ? (
                      <a href={bulletin.pdfUrl} className="inline-flex min-h-10 items-center gap-1.5 text-[0.9375rem] font-semibold text-gold-ink hover:text-moss-deep">
                        <Icon name="download" size={15} /> Prenesi PDF
                      </a>
                    ) : null}
                  </div>
                ) : null}
                {olderBulletins.length ? (
                  <div className="mt-5 border-t border-stone/70 pt-4">
                    <h3 className="text-meta font-semibold text-ink-3">Prejšnja oznanila</h3>
                    <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-small">
                      {olderBulletins.map((b) => (
                        <li key={b.id}>
                          <Link href={routes.bulletin(b.periodStart)} className="whitespace-nowrap font-medium text-ink-2 hover:text-gold-ink">
                            {b.label}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </section>

              {home?.tile?.text ? (
                <figure className="rounded-lg bg-surface px-7 py-9 text-center shadow-soft">
                  <blockquote className="font-serif text-[1.5rem] italic leading-snug text-ink">{home.tile.text}</blockquote>
                  {home.tile.source ? <figcaption className="eyebrow mt-3">{home.tile.source}</figcaption> : null}
                </figure>
              ) : null}

              {events.length ? (
                <div>
                  <div className="mb-2 flex items-center justify-between gap-4 px-2">
                    <h2 className="text-[1.25rem] font-bold tracking-[-0.03em]">Prihajajoči dogodki</h2>
                    <TextLink href={routes.events}>Vsi</TextLink>
                  </div>
                  <ul className="overflow-hidden rounded-lg bg-surface shadow-soft">
                    {events.map((e) => {
                      const d = dateOf(e.start);
                      const where = e.church?.shortName ?? e.locationName;
                      return (
                        <li key={e._id} className="border-b border-stone/70 last:border-b-0">
                          <Link href={routes.event(e.slug)} className="group grid grid-cols-[3.5rem_1fr_auto] items-center gap-4 px-5 py-4 no-underline transition-colors hover:bg-paper">
                            <span className="flex flex-col overflow-hidden rounded-[0.875rem] bg-surface text-center leading-none shadow-soft">
                              <span className="bg-moss py-[3px] text-[0.625rem] font-bold uppercase tracking-[0.08em] text-paper">{formatMonthShort(d)}</span>
                              <span className="py-1.5 text-[1.375rem] font-bold tabular-nums tracking-[-0.05em] text-ink">{formatDayNumber(d)}</span>
                            </span>
                            <span className="min-w-0">
                              <span className="block text-body font-semibold leading-snug tracking-[-0.015em] text-ink">{e.title}</span>
                              <span className="mt-0.5 flex items-center gap-1.5 text-small text-ink-2">
                                <Icon name={where ? "pin" : "clock"} size={14} className="text-gold-ink" />
                                {e.allDay ? "" : `${formatTime(timeOf(e.start))}`}
                                {where ? `${e.allDay ? "" : ", "}${where}` : ""}
                              </span>
                            </span>
                            <Icon name="arrow-right" size={16} className="text-gold-ink transition-transform group-hover:translate-x-[3px]" />
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ) : null}

              {hasImage(home?.tile?.image) && settings?.tagline ? (
                <figure className="relative isolate min-h-[16rem] overflow-hidden rounded-lg bg-paper-3 text-paper shadow-soft">
                  <SanityImage image={home.tile.image} aspect={4 / 3} sizes="(min-width: 1024px) 24rem, 100vw" maxWidth={1000} decorative fill className="-z-20" imgClassName="[filter:saturate(.5)_sepia(.15)]" />
                  <div aria-hidden="true" className="absolute inset-0 -z-10 bg-[linear-gradient(180deg,rgb(14_10_6/0)_35%,rgb(14_10_6/0.75)_100%)]" />
                  <figcaption className="absolute inset-x-0 bottom-0 p-6 font-serif text-[1.375rem] italic leading-snug">{settings.tagline}</figcaption>
                </figure>
              ) : null}
            </aside>
          </div>
        </Container>
      </Section>

      {bulletin ? (
        <Section id="mesecna" className="scroll-mt-24">
          <span id="tedenska" aria-hidden="true" />
          <Container>
            <BulletinView bulletin={bulletin} massDays={massDays} massHeading={massHeading} events={bulletin.events} />
          </Container>
        </Section>
      ) : null}
    </>
  );
}
