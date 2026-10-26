import Link from "next/link";
import type { CURRENT_BULLETIN_QUERY_RESULT } from "@/sanity/types.generated";
import { formatDateSpan, today } from "@/lib/dates";
import type { MassDay } from "@/lib/masses";
import { routes } from "@/lib/routes";
import { Attachments, RichText } from "@/components/sanity/RichText";
import { DayCard } from "@/components/masses/MassList";
import { EventList, type EventCardData } from "@/components/events/EventCard";
import { Notice, TextLink } from "@/components/ui/primitives";

type Props = {
  bulletin: NonNullable<CURRENT_BULLETIN_QUERY_RESULT>;
  massDays: MassDay[];
  /** Events in the same week (auto) merged with the ones editors picked. */
  events: EventCardData[];
  headingLevel?: "h1" | "h2";
};

/**
 * The weekly sheet as an editorial spread: the week set large, liturgical
 * notes, numbered announcements; beside it the Masses and intentions of
 * that week, day by day. No boxes — rules and type carry the structure.
 */
export function BulletinView({ bulletin, massDays, events, headingLevel = "h2" }: Props) {
  const Heading = headingLevel;
  const Sub = headingLevel === "h1" ? "h2" : "h3";
  const t = today();
  const items = bulletin.items ?? [];

  return (
    <article>
      <header className="max-w-3xl">
        <p className="text-small font-medium text-ink-3">Tedenska oznanila</p>
        <Heading className="mt-2 text-display">{formatDateSpan(bulletin.weekStart, bulletin.weekEnd)}</Heading>
        {bulletin.liturgicalNotes?.length ? <RichText value={bulletin.liturgicalNotes} size="lg" className="mt-5 text-ink-2" /> : null}
      </header>

      <div className="mt-12 grid gap-14 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:gap-24">
        <div>
          {items.length ? (
            <ol className="divide-y divide-stone border-t border-stone">
              {items.map((item, i) => (
                <li key={item._key} className="grid grid-cols-[3rem_1fr] gap-x-5 py-7 sm:grid-cols-[4rem_1fr] sm:gap-x-8">
                  <span className="pt-0.5 font-serif text-[1.75rem] leading-none text-gold sm:text-[2rem]" aria-hidden="true">
                    {i + 1}
                  </span>
                  <div className="min-w-0">
                    <Sub className="font-serif text-h3 leading-tight text-ink">
                      <span className="sr-only">{i + 1}. </span>
                      {item.title}
                    </Sub>
                    <RichText value={item.body} className="mt-2" />
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <p className="border-t border-stone pt-6 text-body text-ink-2">Za ta teden ni posebnih oznanil.</p>
          )}

          {bulletin.specialInfo?.length ? (
            <Notice className="mt-10 max-w-none">
              <p className="text-small font-medium text-ink-3">Posebna obvestila</p>
              <RichText value={bulletin.specialInfo} className="mt-1" />
            </Notice>
          ) : null}

          {events.length ? (
            <section className="mt-14">
              <Sub className="mb-5 text-h3">Dogodki v tem tednu</Sub>
              <EventList events={events} />
            </section>
          ) : null}

          <Attachments items={bulletin.attachments} />
        </div>

        <aside>
          <div className="flex items-baseline justify-between gap-4">
            <Sub className="text-small font-medium text-ink-3">Svete maše in nameni</Sub>
            <Link href={routes.intentionsWeek(bulletin.weekStart)} className="text-small text-moss underline underline-offset-4 hover:text-moss-deep">
              Odpri teden
            </Link>
          </div>
          <div className="mt-4 divide-y divide-stone border-t border-stone">
            {massDays.map((day) => (
              <DayCard key={day.date} day={day} today={t} showIntentions plain className="py-5" />
            ))}
          </div>
          <div className="mt-6">
            <TextLink href={routes.masses}>Redni urnik svetih maš</TextLink>
          </div>
        </aside>
      </div>
    </article>
  );
}
