import Link from "next/link";
import type { HOME_PAGE_QUERY_RESULT } from "@/sanity/types.generated";
import { bulletinLabel, type PublicBulletin } from "@/lib/data/bulletins";
import { formatDayHeading, formatTime, type IsoDate } from "@/lib/dates";
import { MASS_TYPE_LABEL, pickTodayOrNext, type MassDay } from "@/lib/masses";
import { routes } from "@/lib/routes";
import { clean } from "@/lib/clean";
import { cn } from "@/lib/utils";
import { SanityImage, hasImage } from "@/components/sanity/SanityImage";
import { Icon, type IconName } from "@/components/ui/Icon";
import { Container } from "@/components/ui/primitives";
import { DayTitle } from "@/components/masses/MassList";

type Props = {
  days: MassDay[];
  today: IsoDate;
  time: string;
  bulletin: PublicBulletin | null;
  tile: NonNullable<HOME_PAGE_QUERY_RESULT>["tile"] | null | undefined;
};

/**
 * The row under the photograph: today's Masses, a quiet image with a
 * thought, and this week's announcements. Three cards, one glance.
 */
export function Today({ days, today, time, bulletin, tile }: Props) {
  const pick = pickTodayOrNext(days, today, time);
  const masses = pick?.masses.slice(0, 4) ?? [];
  const bulletinText = bulletin?.notices.length ? bulletin.notices.map((n) => n.text).join(" ") : (bulletin?.article?.text ?? null);
  const showTile = Boolean(tile?.text || hasImage(tile?.image));

  return (
    <section aria-label="Danes in ta teden" className="relative z-10 -mt-10 sm:-mt-14">
      <Container>
        <div className={cn("grid gap-4 lg:gap-5", showTile ? "md:grid-cols-2 lg:grid-cols-3" : "md:grid-cols-2")}>
          {/* Today */}
          <Card icon="calendar" title={pick?.isToday ? "Danes" : "Naslednje svete maše"} subtitle={formatDayHeading(pick?.day.date ?? today)}>
            {pick ? (
              <ul className="mt-4 divide-y divide-stone border-t border-stone">
                {masses.map((m) => {
                  const cancelled = clean(m.status) === "cancelled";
                  return (
                    <li key={m.key} className="grid grid-cols-[3.75rem_1fr] gap-x-4 py-3">
                      <time dateTime={m.time} className={cn("tnum pt-px text-body font-medium", cancelled ? "text-ink-3 line-through" : "text-ink")}>
                        {formatTime(m.time)}
                      </time>
                      <div className="min-w-0">
                        <p className={cn("text-body font-medium", cancelled ? "text-ink-3 line-through" : "text-ink")}>
                          {MASS_TYPE_LABEL[clean(m.type)] ?? MASS_TYPE_LABEL.regular}
                        </p>
                        <p className="text-small text-ink-2">
                          {m.church?.shortName ?? m.church?.name}
                          {cancelled ? <span className="text-alert"> — odpade</span> : null}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="mt-4 border-t border-stone pt-4 text-small text-ink-2">V naslednjih dneh ni vpisanih svetih maš.</p>
            )}
            {pick ? <DayTitle day={pick.day} className="mt-3 text-ink-3" /> : null}
            <div className="flex-1" />
            <CardLink href={routes.masses}>Vsi časi maš</CardLink>
          </Card>

          {/* Image with a thought */}
          {showTile ? (
            <div className="relative isolate min-h-[16rem] overflow-hidden rounded-md bg-ink text-paper md:min-h-0">
              {hasImage(tile?.image) ? (
                <SanityImage image={tile.image} aspect={4 / 3} sizes="(min-width: 1024px) 24rem, (min-width: 768px) 50vw, 100vw" maxWidth={1000} decorative fill className="-z-20" />
              ) : null}
              <div aria-hidden="true" className="absolute inset-0 -z-10 bg-[linear-gradient(180deg,rgb(20_28_24/0.05),rgb(20_28_24/0.7))]" />
              {tile?.text ? (
                <figure className="absolute inset-x-0 bottom-0 p-6 sm:p-7">
                  <blockquote className="font-serif text-[1.5rem] leading-tight text-paper sm:text-[1.75rem]">{tile.text}</blockquote>
                  {tile.source ? <figcaption className="mt-2 text-small text-paper/80">{tile.source}</figcaption> : null}
                </figure>
              ) : null}
            </div>
          ) : null}

          {/* The current bulletin (monthly) */}
          <Card icon="document" title="Oznanila" subtitle={bulletin ? bulletinLabel(bulletin) : "Ta mesec"}>
            <p className="mt-4 text-body text-ink-2">
              {bulletinText
                ? truncateWords(bulletinText, 26)
                : "Preberite najnovejša oznanila, pomembne informacije in vabila."}
            </p>
            <div className="mt-6">
              <Link
                href={bulletin ? `${routes.announcements}#mesecna` : routes.announcements}
                className="inline-flex min-h-11 items-center rounded-sm bg-moss px-5 text-small font-medium text-paper transition-colors hover:bg-moss-deep"
              >
                Preberi oznanila
              </Link>
            </div>
            <div className="flex-1" />
            <CardLink href={routes.intentions}>Mašni nameni</CardLink>
          </Card>
        </div>
      </Container>
    </section>
  );
}

function Card({ icon, title, subtitle, children }: { icon: IconName; title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col rounded-md border border-stone bg-paper p-6 sm:p-7">
      <div className="flex items-start gap-4">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-sm border border-stone text-moss" aria-hidden="true">
          <Icon name={icon} size={22} />
        </span>
        <div>
          <h2 className="font-serif text-[1.375rem] leading-tight text-ink">{title}</h2>
          <p className="mt-0.5 text-small text-ink-2">{subtitle}</p>
        </div>
      </div>
      <div className="flex flex-1 flex-col">{children}</div>
    </div>
  );
}

function CardLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="group mt-6 inline-flex min-h-10 items-center gap-2 self-start border-t border-stone pt-5 text-[0.75rem] font-semibold uppercase tracking-[0.14em] text-ink hover:text-moss"
    >
      {children}
      <Icon name="arrow-right" size={14} className="transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}

function truncateWords(text: string, words: number): string {
  const parts = text.split(/\s+/);
  return parts.length <= words ? text : `${parts.slice(0, words).join(" ")}…`;
}
