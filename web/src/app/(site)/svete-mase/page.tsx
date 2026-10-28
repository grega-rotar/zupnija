import type { Metadata } from "next";
import Link from "next/link";
import { getActiveSpecialPeriod, getChurchesBrief, getCurrentSchedules, getHomePage, getSettings } from "@/sanity/data";
import { getMassDays, getUpcomingMasses } from "@/lib/data/masses";
import { buildMetadata } from "@/lib/seo";
import { routes } from "@/lib/routes";
import { addDays, compareTime, formatDayHeading, formatTime, today } from "@/lib/dates";
import { MASS_TYPE_LABEL, pickTodayOrNext, type Mass } from "@/lib/masses";
import { clean } from "@/lib/clean";
import { cn, truncate } from "@/lib/utils";
import { PageHero } from "@/components/layout/PageHero";
import { ScheduleMatrix } from "@/components/masses/ScheduleMatrix";
import { dayLines, DayLeaf, MassRow, WeekGrid } from "@/components/masses/MassList";
import { ChurchCard } from "@/components/churches/ChurchCard";
import { Icon, type IconName } from "@/components/ui/Icon";
import { Container, EmptyState, Notice, Section, SectionHeading, TextLink, tile } from "@/components/ui/primitives";

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
  const quote = home?.tile?.text && churches.length < 4 ? { text: home.tile.text, source: home.tile.source } : null;

  return (
    <>
      <PageHero settings={settings} header="massesHeader" title="Svete maše" accent="maše" lede="Današnje maše, redni urnik po cerkvah in posebni termini.">
        {period ? (
          <Notice className="mx-auto mt-8 text-left">
            <span className="font-semibold">{period.title}</span>
            {period.excerpt ? <span className="text-ink-2"> — {truncate(period.excerpt, 120)}</span> : null}{" "}
            <Link href={routes.specialPeriod(period.slug)} className="whitespace-nowrap font-semibold text-gold-ink underline underline-offset-4">
              Program
            </Link>
          </Notice>
        ) : null}
        <nav aria-label="Na tej strani" className="mt-8 flex flex-wrap justify-center gap-2">
          <Pill href="#urnik" icon="calendar">
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
      </PageHero>

      <Section>
        <Container>
          <div className="grid gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <div className="space-y-5">
              <div className={cn(tile, "p-6 sm:p-8")}>
                <p className="eyebrow">{pick?.isToday ? "Danes" : "Naslednje svete maše"}</p>
                {pick ? (
                  <h2 className="mt-2 text-[clamp(1.75rem,1.4rem+1.4vw,2.5rem)] font-bold leading-tight tracking-[-0.045em]">
                    {formatDayHeading(pick.day.date, true)}
                  </h2>
                ) : (
                  <h2 className="mt-2 text-[clamp(1.75rem,1.4rem+1.4vw,2.5rem)] font-bold leading-tight tracking-[-0.045em]">Naslednje svete maše</h2>
                )}
                {pick && dayLines(pick.day).title ? <p className="mt-1.5 text-body text-ink-2">{dayLines(pick.day).title}</p> : null}
                {pick && dayLines(pick.day).gospel ? <p className="mt-1 font-serif text-[1.125rem] italic text-ink-2">{dayLines(pick.day).gospel}</p> : null}
                {pick ? (
                  <ul className="mt-5 divide-y divide-stone/70 border-t border-stone/70">
                    {pick.masses.map((m) => (
                      <MassRow key={m.key} mass={m} showIntentions />
                    ))}
                  </ul>
                ) : (
                  <p className="mt-5 border-t border-stone/70 pt-5 text-body text-ink-2">V naslednjih dneh ni vpisanih svetih maš.</p>
                )}
                <details className="group/d mt-2 border-t border-stone/70 pt-2">
                  <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between rounded-full text-[0.9375rem] font-semibold text-gold-ink [&::-webkit-details-marker]:hidden">
                    Naslednjih sedem dni
                    <Icon name="chevron-down" size={18} className="transition-transform duration-300 group-open/d:rotate-180" />
                  </summary>
                  <div className="pt-3">
                    <WeekGrid days={upcoming.days.slice(0, 7)} today={upcoming.today} time={upcoming.time} />
                  </div>
                </details>
              </div>

              <div id="urnik" className={cn(tile, "scroll-mt-28 p-6 sm:p-8")}>
                <p className="eyebrow">Tedenski urnik</p>
                <h2 className="mt-2 text-[clamp(1.75rem,1.4rem+1.4vw,2.5rem)] font-bold leading-tight tracking-[-0.045em]">
                  Redne <span className="accent">svete maše</span>
                </h2>
                {regular.length || seasonal.length ? (
                  <div className="mt-6 space-y-10">
                    {seasonal.map((s) => (
                      <ScheduleMatrix key={s._id} schedule={s} showTitle />
                    ))}
                    {regular.map((s) => (
                      <ScheduleMatrix key={s._id} schedule={s} showTitle={regular.length > 1 || seasonal.length > 0} />
                    ))}
                  </div>
                ) : (
                  <div className="mt-6">
                    <EmptyState title="Redni urnik še ni vpisan" text="Urnik svetih maš bo objavljen v kratkem." />
                  </div>
                )}
                <p className="mt-6 flex items-start gap-2.5 rounded-md bg-paper-2 px-5 py-4 text-small text-ink-2">
                  <Icon name="alert" size={18} className="mt-0.5 shrink-0 text-gold-ink" />
                  <span>
                    Urnik se lahko spremeni. Za aktualne informacije preverite{" "}
                    <Link href={routes.announcements} className="font-medium text-gold-ink underline underline-offset-4 hover:text-moss-deep">
                      tedenska oznanila
                    </Link>
                    .
                  </span>
                </p>
              </div>
            </div>

            <aside id="posebne" className="scroll-mt-28 self-start rounded-lg bg-[linear-gradient(165deg,var(--color-gold-soft)_0%,#fff_72%)] p-6 shadow-soft sm:p-8">
              <p className="eyebrow">Posebni termini</p>
              <h2 className="mt-2 text-[1.75rem] font-bold leading-tight tracking-[-0.04em]">Posebne svete maše</h2>
              {specials.length ? (
                <ul className="mt-6 space-y-3">
                  {specials.map(({ date, mass }) => (
                    <SpecialRow key={mass.key} date={date} mass={mass} />
                  ))}
                </ul>
              ) : (
                <p className="mt-5 text-body text-ink-2">V naslednjih tednih ni napovedanih posebnih svetih maš.</p>
              )}
              <TextLink href={routes.intentionsWeek(t)} className="mt-4">
                Vsi posebni termini
              </TextLink>
            </aside>
          </div>
        </Container>
      </Section>

      {churches.length ? (
        <Section id="cerkve" className="scroll-mt-24">
          <Container>
            <SectionHeading eyebrow="Cerkve" title="Naše cerkve" accent="cerkve" lede="Urnik, naslov in dostop za vsako cerkev." action={{ label: "Vse cerkve", href: routes.churches }} />
            <div className={cn("grid gap-5 sm:grid-cols-2", churches.length + (quote ? 1 : 0) > 3 ? "lg:grid-cols-4" : "lg:grid-cols-3")}>
              {churches.map((c) => (
                <ChurchCard key={c._id} church={c} />
              ))}
              {quote ? (
                <figure className={cn(tile, "flex flex-col items-center justify-center p-8 text-center")}>
                  <blockquote className="font-serif text-[1.625rem] italic leading-snug text-ink">{quote.text}</blockquote>
                  {quote.source ? <figcaption className="eyebrow mt-4">{quote.source}</figcaption> : null}
                </figure>
              ) : null}
            </div>
          </Container>
        </Section>
      ) : null}
    </>
  );
}

function Pill({ href, icon, children }: { href: string; icon: IconName; children: React.ReactNode }) {
  const classes =
    "inline-flex min-h-11 items-center gap-2 rounded-full bg-surface px-4 sm:px-5 text-[0.9375rem] font-semibold text-ink shadow-soft transition-[transform,background-color] duration-200 hover:scale-[1.02] hover:bg-paper-2 motion-reduce:transform-none";
  return href.startsWith("#") ? (
    <a href={href} className={classes}>
      <Icon name={icon} size={17} className="text-gold-ink" />
      {children}
    </a>
  ) : (
    <Link href={href} className={classes}>
      <Icon name={icon} size={17} className="text-gold-ink" />
      {children}
    </Link>
  );
}

function SpecialRow({ date, mass }: { date: string; mass: Mass }) {
  return (
    <li className="flex items-center gap-4 rounded-md bg-surface/80 p-3 shadow-[inset_0_0_0_1px_rgb(31_28_24/0.06)]">
      <DayLeaf date={date} />
      <div className="min-w-0">
        <p className="font-semibold tracking-[-0.015em] text-ink">{MASS_TYPE_LABEL[clean(mass.type)] ?? MASS_TYPE_LABEL.regular}</p>
        <p className="text-small text-ink-2">{mass.church?.shortName ?? mass.church?.name}</p>
        <p className="text-small text-ink-3">
          ob {formatTime(mass.time)}
          {mass.note ? ` · ${mass.note}` : ""}
        </p>
      </div>
    </li>
  );
}
