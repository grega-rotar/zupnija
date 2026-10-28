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
import { TextLink } from "@/components/ui/primitives";

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
 * The bulletin as an editorial spread: title and issue set large; the
 * article, the prayer intention, numbered notices and the period's meetings;
 * beside it the Masses and intentions, day by day, with links to every week
 * of the period. No boxes, except the prayer intention — rules and type
 * carry the structure.
 */
export function BulletinView({ bulletin, massDays, massHeading = "Svete maše in nameni", events, headingLevel = "h2" }: Props) {
  const Heading = headingLevel;
  const Sub = headingLevel === "h1" ? "h2" : "h3";
  const t = today();
  const items = bulletin.notices;
  const weeks = weekStarts(bulletin.periodStart, bulletin.periodEnd);

  return (
    <article>
      <header className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-3xl">
          <p className="text-small font-medium text-ink-3">Oznanila župnije Pirniče</p>
          <Heading className="mt-2 text-display">{bulletinLabel(bulletin)}</Heading>
          {bulletin.issue ? <p className="mt-2 text-small uppercase tracking-[0.14em] text-ink-3">{bulletin.issue}</p> : null}
        </div>
        {bulletin.pdfUrl ? (
          <a
            href={bulletin.pdfUrl}
            className="inline-flex min-h-12 shrink-0 items-center justify-center gap-2 self-start rounded-sm bg-moss px-6 text-body font-medium text-paper transition-colors hover:bg-moss-deep sm:self-auto"
          >
            <Icon name="download" size={18} />
            <span>Prenesi PDF</span>
          </a>
        ) : null}
      </header>

      <div className="mt-12 grid gap-14 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:gap-24">
        <div className="min-w-0">
          {bulletin.article ? (
            <section className="mb-14 border-t border-stone pt-7">
              {bulletin.article.title ? <Sub className="text-h2">{bulletin.article.title}</Sub> : null}
              <RichText value={textBlocks(bulletin.article.text, `a${bulletin.id}`)} className="mt-4" />
            </section>
          ) : null}

          {bulletin.prayerIntention ? (
            <section className="mb-14 rounded-md border border-stone bg-paper p-6 sm:p-7">
              <p className="font-sans text-[0.75rem] font-semibold uppercase tracking-[0.14em] text-ink-3">Molitveni namen</p>
              {bulletin.prayerIntention.title ? <Sub className="mt-3 font-serif text-h3 text-ink">{bulletin.prayerIntention.title}</Sub> : null}
              <p className="mt-2 text-body text-ink-2">{bulletin.prayerIntention.text}</p>
              <span className="mt-5 block h-px w-12 bg-gold" aria-hidden="true" />
            </section>
          ) : null}

          <Sub className="mb-1 text-h3">Obvestila</Sub>
          {items.length ? (
            <ol className="divide-y divide-stone border-t border-stone">
              {items.map((item, i) => (
                <li key={item.key} className="grid grid-cols-[3rem_1fr] gap-x-5 py-7 sm:grid-cols-[4rem_1fr] sm:gap-x-8">
                  <span className="pt-0.5 font-serif text-[1.75rem] leading-none text-gold sm:text-[2rem]" aria-hidden="true">
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
            <p className="border-t border-stone pt-6 text-body text-ink-2">Ni posebnih obvestil.</p>
          )}

          {events.length ? (
            <section className="mt-14">
              <Sub className="mb-5 text-h3">Srečanja in dogodki</Sub>
              <EventList events={events} />
            </section>
          ) : null}
        </div>

        <aside className="min-w-0">
          <div className="flex items-baseline justify-between gap-4">
            <Sub className="text-small font-medium text-ink-3">{massHeading}</Sub>
            {massDays[0] ? (
              <Link href={routes.intentionsWeek(massDays[0].date)} className="text-small text-moss underline underline-offset-4 hover:text-moss-deep">
                Odpri teden
              </Link>
            ) : null}
          </div>
          <div className="mt-4 divide-y divide-stone border-t border-stone">
            {massDays.map((day) => (
              <DayCard key={day.date} day={day} today={t} showIntentions plain className="py-5" />
            ))}
          </div>
          {weeks.length > 1 ? (
            <nav aria-label="Mašni nameni po tednih" className="mt-8 border-t border-stone pt-5">
              <p className="text-meta text-ink-3">Mašni nameni po tednih</p>
              <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-small">
                {weeks.map((w) => (
                  <li key={w}>
                    <Link href={routes.bulletin(w)} className="whitespace-nowrap text-ink-2 underline decoration-stone-2 underline-offset-4 hover:text-ink">
                      {formatWeekSpan(w, plusSix(w))}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ) : null}
          <div className="mt-6">
            <TextLink href={routes.masses}>Redni urnik svetih maš</TextLink>
          </div>
        </aside>
      </div>
    </article>
  );
}
