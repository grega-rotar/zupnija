import Link from "next/link";
import { bulletinLabel, type PublicBulletin } from "@/lib/data/bulletins";
import { formatWeekSpan, today, type IsoDate } from "@/lib/dates";
import type { MassDay } from "@/lib/masses";
import { routes } from "@/lib/routes";
import { RichText } from "@/components/sanity/RichText";
import { textBlocks } from "@/lib/data/text";
import { DayCard } from "@/components/masses/MassList";
import { EventList, type EventCardData } from "@/components/events/EventCard";
import { Icon } from "@/components/ui/Icon";
import { TextLink, buttonClassName, headline, tile } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

type Props = {
  bulletin: PublicBulletin;
  /** The Masses to show beside the text: the current week of the period, or the week of an old weekly route. */
  massDays: MassDay[];
  /** Heading of the Masses column, e.g. "Ta teden" or "25.–31. oktober". */
  massHeading?: string;
  /** Events and meetings in the bulletin's period. */
  events: EventCardData[];
  headingLevel?: "h1" | "h2";
};

/** Sundays starting the weeks that touch [from, to]. */
function weekStarts(from: IsoDate, to: IsoDate): IsoDate[] {
  const out: IsoDate[] = [];
  const d = new Date(`${from}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - d.getUTCDay());
  for (let s = d.toISOString().slice(0, 10); s <= to; ) {
    out.push(s);
    d.setUTCDate(d.getUTCDate() + 7);
    s = d.toISOString().slice(0, 10);
  }
  return out;
}
const plusSix = (s: IsoDate) => {
  const d = new Date(`${s}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 6);
  return d.toISOString().slice(0, 10);
};

/**
 * The bulletin as a v4 spread: a centered opening (title and issue set
 * large, the PDF as a pill); then a white tile with the article, the prayer
 * intention, numbered notices and the period's meetings; beside it a tile
 * with the Masses and intentions, day by day, and every week of the period.
 */
export function BulletinView({ bulletin, massDays, massHeading = "Svete maše in nameni", events, headingLevel = "h2" }: Props) {
  const Heading = headingLevel;
  const Sub = headingLevel === "h1" ? "h2" : "h3";
  const t = today();
  const items = bulletin.notices;
  const weeks = weekStarts(bulletin.periodStart, bulletin.periodEnd);

  return (
    <article>
      <header className="mx-auto mb-10 flex max-w-3xl flex-col items-center text-center lg:mb-14">
        <p className="eyebrow">Oznanila župnije Pirniče</p>
        <Heading className={cn("mt-3.5", headingLevel === "h1" ? headline.display : headline.h2)}>{bulletinLabel(bulletin)}</Heading>
        {bulletin.issue ? <p className="lede mt-4">{bulletin.issue}</p> : null}
        {bulletin.pdfUrl ? (
          <a href={bulletin.pdfUrl} className={cn(buttonClassName(), "mt-7")}>
            <Icon name="download" size={18} />
            <span>Prenesi PDF</span>
          </a>
        ) : null}
      </header>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
        <div className={cn(tile, "min-w-0 self-start p-6 sm:p-10")}>
          {bulletin.article ? (
            <section className="mb-12">
              {bulletin.article.title ? <Sub className="text-[clamp(1.75rem,1.5rem+1vw,2.25rem)] font-bold leading-tight tracking-[-0.045em]">{bulletin.article.title}</Sub> : null}
              <RichText value={textBlocks(bulletin.article.text, `a${bulletin.id}`)} className="mt-4" />
            </section>
          ) : null}

          {bulletin.prayerIntention ? (
            <section className="mb-12 rounded-md bg-gold-soft p-6 sm:p-7">
              <p className="eyebrow">Molitveni namen</p>
              {bulletin.prayerIntention.title ? <Sub className="mt-2 font-serif text-[1.5rem] font-normal italic leading-snug text-ink">{bulletin.prayerIntention.title}</Sub> : null}
              <p className="mt-2 text-body text-ink-2">{bulletin.prayerIntention.text}</p>
            </section>
          ) : null}

          <Sub className="mb-2 text-[1.5rem] font-bold tracking-[-0.035em]">Obvestila</Sub>
          {items.length ? (
            <ol className="divide-y divide-stone/70">
              {items.map((item, i) => (
                <li key={item.key} className="grid grid-cols-[2.5rem_1fr] gap-x-4 py-6 sm:grid-cols-[3.5rem_1fr] sm:gap-x-6">
                  <span className="pt-0.5 text-[1.5rem] font-bold leading-none tabular-nums tracking-[-0.04em] text-gold-ink sm:text-[1.75rem]" aria-hidden="true">
                    {i + 1}
                  </span>
                  <div className="min-w-0">
                    <span className="sr-only">{i + 1}. </span>
                    <RichText value={textBlocks(item.text, item.key)} />
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <p className="pt-4 text-body text-ink-2">Ni posebnih obvestil.</p>
          )}

          {events.length ? (
            <section className="mt-12">
              <Sub className="mb-4 text-[1.5rem] font-bold tracking-[-0.035em]">Srečanja in dogodki</Sub>
              <EventList events={events} />
            </section>
          ) : null}
        </div>

        <aside className={cn(tile, "min-w-0 self-start p-6 sm:p-8")}>
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="eyebrow">Svete maše in nameni</p>
              <Sub className="mt-1 text-[1.5rem] font-bold tracking-[-0.035em]">{massHeading}</Sub>
            </div>
            {massDays[0] ? <TextLink href={routes.intentionsWeek(massDays[0].date)}>Odpri teden</TextLink> : null}
          </div>
          <div className="mt-4 divide-y divide-stone/70 border-t border-stone/70">
            {massDays.map((day) => (
              <DayCard key={day.date} day={day} today={t} showIntentions plain className="py-5" />
            ))}
          </div>
          {weeks.length > 1 ? (
            <nav aria-label="Mašni nameni po tednih" className="mt-6 border-t border-stone/70 pt-5">
              <p className="text-meta font-semibold text-ink-3">Mašni nameni po tednih</p>
              <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-small">
                {weeks.map((w) => (
                  <li key={w}>
                    <Link href={routes.bulletin(w)} className="whitespace-nowrap font-medium text-ink-2 hover:text-gold-ink">
                      {formatWeekSpan(w, plusSix(w))}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ) : null}
          <div className="mt-4">
            <TextLink href={routes.masses}>Redni urnik svetih maš</TextLink>
          </div>
        </aside>
      </div>
    </article>
  );
}
