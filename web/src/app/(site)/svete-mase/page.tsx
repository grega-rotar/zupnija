import type { Metadata } from "next";
import Link from "next/link";
import { getActiveSpecialPeriod, getChurchesBrief, getCurrentSchedules, getHomePage, getSettings } from "@/sanity/data";
import { getMassDays, getUpcomingMasses } from "@/lib/data/masses";
import { buildMetadata } from "@/lib/seo";
import { routes } from "@/lib/routes";
import { addDays, compareTime, formatDayHeading, formatDayNumber, formatMonthShort, formatTime, today } from "@/lib/dates";
import { MASS_TYPE_LABEL, pickTodayOrNext, type Mass } from "@/lib/masses";
import { clean } from "@/lib/clean";
import { truncate } from "@/lib/utils";
import { CHURCH_KIND_LABEL } from "@/lib/labels";
import { PageHero } from "@/components/layout/PageHero";
import { ScheduleMatrix } from "@/components/masses/ScheduleMatrix";
import { MassRow, WeekGrid } from "@/components/masses/MassList";
import { SanityImage, hasImage, ImagePlaceholder } from "@/components/sanity/SanityImage";
import { Icon, type IconName } from "@/components/ui/Icon";
import { Container, EmptyState, Notice, Section } from "@/components/ui/primitives";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSettings();
  return buildMetadata({
    settings,
    title: "Svete maše",
    description: "Urnik svetih maš v župniji Pirniče: današnje maše, redni tedenski urnik po cerkvah in posebni termini.",
    path: routes.masses,
  });
}

const SPECIAL_TYPES = new Set(["feast", "midnight", "vigil", "funeral", "wedding", "other"]);

export default async function MassesPage() {
  const t = today();
  const [settings, upcoming, schedules, churches, period, home, horizon] = await Promise.all([
    getSettings(),
    getUpcomingMasses(7),
    getCurrentSchedules(),
    getChurchesBrief(),
    getActiveSpecialPeriod(),
    getHomePage(),
    getMassDays(t, addDays(t, 90)),
  ]);

  const pick = pickTodayOrNext(upcoming.days, upcoming.today, upcoming.time);
  const regular = schedules.filter((s) => !s.validFrom && !s.validUntil);
  const seasonal = schedules.filter(
    (s) => (s.validFrom || s.validUntil) && (!s.validFrom || s.validFrom <= t) && (!s.validUntil || s.validUntil >= t),
  );

  // Masses outside the ordinary weekly rhythm: feasts, vigils, funerals, extra Masses.
  const specials = horizon
    .flatMap((day) => day.masses.map((m) => ({ date: day.date, mass: m })))
    .filter(({ date, mass }) => !(date === t && compareTime(mass.time, upcoming.time) < 0))
    .filter(({ mass }) => mass.status !== "cancelled" && (!mass.recurring || SPECIAL_TYPES.has(clean(mass.type))))
    .slice(0, 6);

  return (
    <>
      <PageHero settings={settings} header="massesHeader" title="Svete maše" lede="Današnje maše, redni urnik po cerkvah in posebni termini.">
        {period ? (
          <Notice className="mt-8 bg-paper/15 text-paper">
            <span className="font-medium">{period.title}</span>
            {period.excerpt ? <span className="text-paper/85"> — {truncate(period.excerpt, 120)}</span> : null}{" "}
            <Link href={routes.specialPeriod(period.slug)} className="whitespace-nowrap font-medium underline underline-offset-4">
              Program
            </Link>
          </Notice>
        ) : null}
      </PageHero>

      <Section tight>
        <Container>
          <nav aria-label="Na tej strani" className="-mt-2 mb-8 flex gap-2 overflow-x-auto pb-1 no-scrollbar">
            <Pill href="#urnik" icon="calendar" active>
              Tedenski urnik
            </Pill>
            <Pill href="#posebne" icon="calendar">
              Posebni termini
            </Pill>
            <Pill href={routes.intentions} icon="document">
              Mašni nameni
            </Pill>
            <Pill href="#cerkve" icon="pin">
              Cerkve
            </Pill>
          </nav>

          <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] lg:gap-8">
            <div className="space-y-6">
              <div className="rounded-md border border-stone bg-paper p-5 sm:p-7">
                <h2 className="text-h2">{pick?.isToday ? "Danes" : "Naslednje svete maše"}</h2>
                {pick ? (
                  <p className="mt-1.5 flex flex-wrap items-center gap-x-2 text-body text-ink-2">
                    <Icon name="calendar" size={16} className="text-ink-3" />
                    <span>{formatDayHeading(pick.day.date, true)}</span>
                    {pick.day.liturgicalTitle ? <span className="text-ink-3">· {pick.day.liturgicalTitle}</span> : null}
                  </p>
                ) : null}
                {pick ? (
                  <ul className="mt-4 divide-y divide-stone border-t border-stone">
                    {pick.masses.map((m) => (
                      <MassRow key={m.key} mass={m} showIntentions />
                    ))}
                  </ul>
                ) : (
                  <p className="mt-4 border-t border-stone pt-4 text-body text-ink-2">V naslednjih dneh ni vpisanih svetih maš.</p>
                )}
                <details className="mt-4 border-t border-stone pt-3">
                  <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between text-small font-medium text-ink [&::-webkit-details-marker]:hidden">
                    Naslednjih sedem dni
                    <Icon name="chevron-down" size={18} className="text-ink-3" />
                  </summary>
                  <div className="pt-3">
                    <WeekGrid days={upcoming.days.slice(0, 7)} today={upcoming.today} time={upcoming.time} />
                  </div>
                </details>
              </div>

              <div id="urnik" className="scroll-mt-24 rounded-md border border-stone bg-paper p-5 sm:p-7">
                <h2 className="text-h2">Redne svete maše</h2>
                {regular.length || seasonal.length ? (
                  <div className="mt-5 space-y-10">
                    {seasonal.map((s) => (
                      <ScheduleMatrix key={s._id} schedule={s} showTitle />
                    ))}
                    {regular.map((s) => (
                      <ScheduleMatrix key={s._id} schedule={s} showTitle={regular.length > 1 || seasonal.length > 0} />
                    ))}
                  </div>
                ) : (
                  <div className="mt-5">
                    <EmptyState title="Redni urnik še ni vpisan" text="Urnik svetih maš bo objavljen v kratkem." />
                  </div>
                )}
                <p className="mt-5 flex items-start gap-2.5 rounded-sm bg-paper-2 px-4 py-3 text-small text-ink-2">
                  <Icon name="alert" size={18} className="mt-0.5 shrink-0 text-ink-3" />
                  <span>
                    Urnik se lahko spremeni. Za aktualne informacije preverite{" "}
                    <Link href={routes.announcements} className="underline underline-offset-4 hover:text-ink">
                      tedenska oznanila
                    </Link>
                    .
                  </span>
                </p>
              </div>
            </div>

            <aside id="posebne" className="scroll-mt-24 self-start rounded-md border border-stone bg-paper-2 p-5 sm:p-7">
              <h2 className="text-h3">Posebne svete maše</h2>
              {specials.length ? (
                <ul className="mt-5 space-y-3">
                  {specials.map(({ date, mass }) => (
                    <SpecialRow key={mass.key} date={date} mass={mass} />
                  ))}
                </ul>
              ) : (
                <p className="mt-5 text-small text-ink-2">V naslednjih tednih ni napovedanih posebnih svetih maš.</p>
              )}
              <Link
                href={routes.intentionsWeek(t)}
                className="mt-6 flex min-h-12 items-center justify-center gap-2 rounded-sm border border-stone bg-paper text-[0.75rem] font-semibold uppercase tracking-[0.14em] text-ink hover:border-ink"
              >
                Vsi posebni termini
                <Icon name="arrow-right" size={14} />
              </Link>
            </aside>
          </div>
        </Container>
      </Section>

      {churches.length ? (
        <Section tight id="cerkve" className="scroll-mt-24 border-t border-stone">
          <Container>
            <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
              <h2 className="text-h2">Naše cerkve</h2>
              <Link href={routes.churches} className="inline-flex min-h-10 items-center gap-2 text-[0.75rem] font-semibold uppercase tracking-[0.14em] text-ink hover:text-moss">
                Vse cerkve <Icon name="arrow-right" size={14} />
              </Link>
            </div>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {churches.map((c) => (
                <article key={c._id} className="group overflow-hidden rounded-md border border-stone bg-paper">
                  <Link href={routes.church(c.slug)} className="block no-underline">
                    {hasImage(c.image) ? (
                      <SanityImage
                        image={c.image}
                        aspect={4 / 3}
                        sizes="(min-width: 1024px) 18rem, (min-width: 640px) 50vw, 100vw"
                        maxWidth={800}
                        decorative
                        imgClassName="transition-transform duration-700 ease-out-soft group-hover:scale-[1.02] motion-reduce:transform-none"
                      />
                    ) : (
                      <ImagePlaceholder className="aspect-[4/3]" />
                    )}
                    <div className="p-4 sm:p-5">
                      <h3 className="font-serif text-h3 leading-tight text-ink group-hover:underline">{c.name}</h3>
                      <p className="mt-1 text-small text-ink-2">{c.address?.city ?? CHURCH_KIND_LABEL[clean(c.kind)]}</p>
                      <span className="mt-4 inline-flex items-center gap-2 text-[0.75rem] font-semibold uppercase tracking-[0.14em] text-ink">
                        Oglej si urnik <Icon name="arrow-right" size={14} />
                      </span>
                    </div>
                  </Link>
                </article>
              ))}
              {home?.tile?.text && churches.length < 4 ? (
                <figure className="flex flex-col items-center justify-center rounded-md border border-stone bg-paper-2 p-8 text-center">
                  <span className="font-serif text-[3rem] leading-none text-stone-2" aria-hidden="true">
                    “
                  </span>
                  <blockquote className="mt-2 font-serif text-h3 leading-snug text-ink">{home.tile.text}</blockquote>
                  {home.tile.source ? (
                    <figcaption className="mt-3 text-[0.75rem] font-semibold uppercase tracking-[0.14em] text-ink-3">{home.tile.source}</figcaption>
                  ) : null}
                  <span className="mt-4 block h-px w-12 bg-gold" aria-hidden="true" />
                </figure>
              ) : null}
            </div>
          </Container>
        </Section>
      ) : null}
    </>
  );
}

function Pill({ href, icon, active, children }: { href: string; icon: IconName; active?: boolean; children: React.ReactNode }) {
  const classes =
    "inline-flex min-h-12 shrink-0 items-center gap-2.5 rounded-sm px-5 text-body font-medium transition-colors " +
    (active ? "bg-moss text-paper" : "bg-paper-2 text-ink hover:bg-paper-3");
  return href.startsWith("#") ? (
    <a href={href} className={classes}>
      <Icon name={icon} size={18} />
      {children}
    </a>
  ) : (
    <Link href={href} className={classes}>
      <Icon name={icon} size={18} />
      {children}
    </Link>
  );
}

function SpecialRow({ date, mass }: { date: string; mass: Mass }) {
  return (
    <li className="grid grid-cols-[3.75rem_1fr] gap-4 rounded-md border border-stone bg-paper p-3.5">
      <div className="flex flex-col items-center justify-center rounded-sm bg-paper-2 py-1.5 leading-none">
        <span className="font-serif text-[1.625rem] text-ink">{formatDayNumber(date)}</span>
        <span className="mt-1 text-[0.7rem] font-semibold uppercase tracking-wider text-ink-3">{formatMonthShort(date)}</span>
      </div>
      <div className="min-w-0">
        <p className="font-medium text-ink">{MASS_TYPE_LABEL[clean(mass.type)] ?? MASS_TYPE_LABEL.regular}</p>
        <p className="text-small text-ink-2">{mass.church?.name ?? mass.church?.shortName}</p>
        <p className="text-small text-ink-3">
          ob {formatTime(mass.time)}
          {mass.note ? ` · ${mass.note}` : ""}
        </p>
      </div>
    </li>
  );
}
