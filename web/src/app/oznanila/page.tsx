import type { Metadata } from "next";
import Link from "next/link";
import {
  getBulletinList,
  getCurrentAnnouncements,
  getCurrentBulletin,
  getEventsInRange,
  getHomePage,
  getMassDays,
  getSettings,
  getUpcomingEvents,
} from "@/sanity/data";
import { buildMetadata } from "@/lib/seo";
import { routes } from "@/lib/routes";
import { dateOf, formatDate, formatDateSpan, formatDayNumber, formatMonthShort, formatTime, timeOf } from "@/lib/dates";
import { clean } from "@/lib/clean";
import { ANNOUNCEMENT_CATEGORY_LABEL } from "@/lib/labels";
import { hrefFor, isExternalHref } from "@/lib/links";
import { cn, formatFileSize } from "@/lib/utils";
import { PageHero } from "@/components/layout/PageHero";
import { BulletinView } from "@/components/announcements/BulletinView";
import { SanityImage, hasImage } from "@/components/sanity/SanityImage";
import { Icon } from "@/components/ui/Icon";
import { Container, EmptyState, Section, Tag } from "@/components/ui/primitives";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSettings();
  return buildMetadata({
    settings,
    title: "Oznanila",
    description: "Aktualna oznanila in tedenska oznanila župnije Pirniče.",
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
  const [massDays, autoEvents] = bulletin
    ? await Promise.all([getMassDays(bulletin.weekStart, bulletin.weekEnd), getEventsInRange(bulletin.weekStart, bulletin.weekEnd)])
    : [[], []];
  const pickedIds = new Set((bulletin?.events ?? []).map((e) => e._id));
  const weekEvents = [...(bulletin?.events ?? []), ...autoEvents.filter((e) => !pickedIds.has(e._id))];

  const usedCategories = new Set(announcements.map((a) => clean(a.category) ?? "notice"));
  const filters = FILTERS.filter((f) => !f.key || usedCategories.has(f.key));
  const filter = filters.some((f) => f.key === vrsta) ? vrsta : "";
  const shown = filter ? announcements.filter((a) => clean(a.category) === filter) : announcements;

  const bulletinPdf = bulletin?.attachments?.find((a) => a.file?.asset?.url);
  const olderBulletins = list.filter((b) => b._id !== bulletin?._id).slice(0, 5);

  return (
    <>
      <PageHero settings={settings} header="announcementsHeader" title="Oznanila" lede="Kar je trenutno pomembno v župniji." />

      <Section tight>
        <Container>
          <div className="grid gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] lg:gap-8">
            <div>
              {/* Filters */}
              <nav aria-label="Vrsta oznanil" className="-mt-2 mb-6 flex gap-2 overflow-x-auto pb-1 no-scrollbar">
                {filters.map((f) => (
                  <Link
                    key={f.key}
                    href={f.key ? `${routes.announcements}?vrsta=${f.key}` : routes.announcements}
                    aria-current={f.key === filter ? "true" : undefined}
                    className={cn(
                      "inline-flex min-h-12 shrink-0 items-center rounded-sm px-5 text-body font-medium transition-colors",
                      f.key === filter ? "bg-moss text-paper" : "bg-paper-2 text-ink hover:bg-paper-3",
                    )}
                  >
                    {f.label}
                  </Link>
                ))}
              </nav>

              {shown.length ? (
                <ul className="space-y-4">
                  {shown.map((a) => {
                    const category = clean(a.category) ?? "notice";
                    const importance = clean(a.importance);
                    const ctaHref = hrefFor(a.cta);
                    return (
                      <li key={a._id} className="overflow-hidden rounded-md border border-stone bg-paper">
                        <article className={cn("grid gap-5 p-4 sm:gap-6 sm:p-5", hasImage(a.image) && "sm:grid-cols-[16rem_1fr]")}>
                          {hasImage(a.image) ? (
                            <Link href={routes.announcement(a.slug)} className="block" tabIndex={-1} aria-hidden="true">
                              <SanityImage image={a.image} aspect={4 / 3} sizes="(min-width: 640px) 16rem, 100vw" maxWidth={800} decorative className="rounded-sm" />
                            </Link>
                          ) : null}
                          <div className="flex min-w-0 flex-col">
                            <div className="flex flex-wrap items-center gap-2">
                              <Tag tone={importance === "urgent" ? "alert" : importance === "important" ? "gold" : "moss"}>
                                {importance === "urgent" ? "Nujno" : ANNOUNCEMENT_CATEGORY_LABEL[category] ?? "Obvestilo"}
                              </Tag>
                              {a.hasAttachments ? (
                                <span className="inline-flex items-center gap-1 text-meta text-ink-3">
                                  <Icon name="document" size={14} /> priponka
                                </span>
                              ) : null}
                            </div>
                            <h2 className="mt-2 font-serif text-[1.5rem] leading-tight text-ink sm:text-[1.75rem]">
                              <Link href={routes.announcement(a.slug)} className="hover:underline">
                                {a.title}
                              </Link>
                            </h2>
                            <p className="mt-2 flex items-center gap-1.5 text-small text-ink-3">
                              <Icon name="calendar" size={15} />
                              <time dateTime={a.publishFrom}>{formatDate(dateOf(a.publishFrom))}</time>
                              {a.publishUntil ? <span>· velja do {formatDate(dateOf(a.publishUntil))}</span> : null}
                            </p>
                            {a.summary ? <p className="mt-3 text-body text-ink-2">{a.summary}</p> : null}
                            <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1">
                              <Link
                                href={routes.announcement(a.slug)}
                                className="inline-flex min-h-10 items-center gap-2 text-[0.75rem] font-semibold uppercase tracking-[0.14em] text-ink hover:text-moss"
                              >
                                Preberi več <Icon name="arrow-right" size={14} />
                              </Link>
                              {ctaHref && a.cta?.label ? (
                                <a
                                  href={ctaHref}
                                  target={isExternalHref(ctaHref) ? "_blank" : undefined}
                                  rel={isExternalHref(ctaHref) ? "noopener noreferrer" : undefined}
                                  className="inline-flex min-h-10 items-center gap-2 text-[0.75rem] font-semibold uppercase tracking-[0.14em] text-moss hover:text-moss-deep"
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

              <p className="mt-8">
                <Link href={routes.announcementsArchive} className="inline-flex min-h-10 items-center gap-2 text-[0.75rem] font-semibold uppercase tracking-[0.14em] text-ink hover:text-moss">
                  Arhiv oznanil <Icon name="arrow-right" size={14} />
                </Link>
              </p>
            </div>

            {/* Sidebar */}
            <aside className="space-y-6 lg:pt-14">
              <div className="rounded-md border border-stone bg-paper-2 p-6 sm:p-7">
                <div className="flex items-start gap-5">
                  <Icon name="document" size={40} className="shrink-0 text-ink" />
                  <div>
                    <h2 className="text-h3">Tedenska oznanila{bulletinPdf ? " v PDF" : ""}</h2>
                    <p className="mt-1.5 text-body text-ink-2">
                      {bulletin ? (
                        <>
                          Oznanila za teden <span className="whitespace-nowrap">{formatDateSpan(bulletin.weekStart, bulletin.weekEnd)}</span>.
                        </>
                      ) : (
                        "Tedenska oznanila se objavijo ob nedeljah."
                      )}
                    </p>
                  </div>
                </div>
                {bulletinPdf?.file?.asset?.url ? (
                  <a
                    href={`${bulletinPdf.file.asset.url}?dl=`}
                    className="mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2.5 rounded-sm bg-moss px-5 py-2.5 text-center font-medium text-paper hover:bg-moss-deep"
                  >
                    <Icon name="download" size={18} className="shrink-0" />
                    <span>
                      Prenesi oznanila
                      {bulletinPdf.file.asset.size ? <span className="whitespace-nowrap text-paper/70"> (PDF, {formatFileSize(bulletinPdf.file.asset.size)})</span> : null}
                    </span>
                  </a>
                ) : bulletin ? (
                  <a href="#tedenska" className="mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2.5 rounded-sm bg-moss px-5 font-medium text-paper hover:bg-moss-deep">
                    Preberi tedenska oznanila
                  </a>
                ) : null}
                {olderBulletins.length ? (
                  <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-small">
                    {olderBulletins.map((b) => (
                      <li key={b._id}>
                        <Link href={routes.bulletin(b.weekStart)} className="text-ink-2 underline decoration-stone-2 underline-offset-4 hover:text-ink">
                          {formatDateSpan(b.weekStart, b.weekEnd)}
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>

              {home?.tile?.text ? (
                <figure className="rounded-md border border-stone bg-paper-2 px-6 py-7 text-center">
                  <span className="font-serif text-[3rem] leading-none text-stone-2" aria-hidden="true">
                    “
                  </span>
                  <blockquote className="lede mt-1 text-ink">{home.tile.text}</blockquote>
                  {home.tile.source ? <figcaption className="mt-2 text-small text-ink-2">{home.tile.source}</figcaption> : null}
                  <span className="mx-auto mt-4 block h-px w-12 bg-gold" aria-hidden="true" />
                </figure>
              ) : null}

              {events.length ? (
                <div>
                  <div className="mb-4 flex items-baseline justify-between gap-4">
                    <h2 className="text-h3">Prihajajoči dogodki</h2>
                    <Link href={routes.events} className="text-[0.75rem] font-semibold uppercase tracking-[0.14em] text-ink hover:text-moss">
                      Vsi dogodki
                    </Link>
                  </div>
                  <ul className="overflow-hidden rounded-md border border-stone bg-paper">
                    {events.map((e) => {
                      const d = dateOf(e.start);
                      const where = e.church?.shortName ?? e.locationName;
                      return (
                        <li key={e._id} className="border-b border-stone last:border-b-0">
                          <Link href={routes.event(e.slug)} className="group grid grid-cols-[4rem_1fr_auto] items-center gap-4 p-3.5 no-underline">
                            <span className="flex flex-col items-center rounded-sm bg-paper-2 py-1.5 leading-none">
                              <span className="font-serif text-[1.5rem] text-ink">{formatDayNumber(d)}</span>
                              <span className="mt-1 text-[0.7rem] font-semibold uppercase tracking-wider text-ink-3">{formatMonthShort(d)}</span>
                            </span>
                            <span className="min-w-0">
                              <span className="block font-serif text-lede leading-tight text-ink group-hover:underline">{e.title}</span>
                              <span className="mt-1 flex items-center gap-1.5 text-small text-ink-2">
                                <Icon name={where ? "pin" : "clock"} size={14} className="text-ink-3" />
                                {e.allDay ? "" : `${formatTime(timeOf(e.start))}`}
                                {where ? `${e.allDay ? "" : ", "}${where}` : ""}
                              </span>
                            </span>
                            <Icon name="arrow-right" size={16} className="text-ink-3 transition-transform group-hover:translate-x-0.5" />
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ) : null}

              {hasImage(home?.tile?.image) && settings?.tagline ? (
                <figure className="relative isolate min-h-[14rem] overflow-hidden rounded-md bg-ink text-paper">
                  <SanityImage image={home.tile.image} aspect={4 / 3} sizes="(min-width: 1024px) 24rem, 100vw" maxWidth={1000} decorative fill className="-z-20" />
                  <div aria-hidden="true" className="absolute inset-0 -z-10 bg-[linear-gradient(90deg,rgb(20_28_24/0.05),rgb(20_28_24/0.6))]" />
                  <figcaption className="absolute inset-y-0 right-0 flex w-1/2 flex-col items-end justify-center p-6 text-right font-serif text-lede leading-snug">
                    {settings.tagline}
                    <span className="mt-3 block h-px w-10 bg-paper/70" aria-hidden="true" />
                  </figcaption>
                </figure>
              ) : null}
            </aside>
          </div>
        </Container>
      </Section>

      {bulletin ? (
        <Section tone="paper-2" id="tedenska" className="scroll-mt-16 border-t border-stone">
          <Container>
            <BulletinView bulletin={bulletin} massDays={massDays} events={weekEvents} />
          </Container>
        </Section>
      ) : null}
    </>
  );
}
