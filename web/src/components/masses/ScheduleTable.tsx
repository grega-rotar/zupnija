import Link from "next/link";
import type { CURRENT_SCHEDULES_QUERY_RESULT } from "@/sanity/types.generated";
import { WEEKDAY_LABEL, formatDateSpan, formatTime, type Weekday } from "@/lib/dates";
import { MASS_TYPE_LABEL, scheduleByChurch } from "@/lib/masses";
import { routes } from "@/lib/routes";
import { clean } from "@/lib/clean";
import { cn } from "@/lib/utils";
import { RichText } from "@/components/sanity/RichText";
import { SanityImage, hasImage, type SanityImageValue } from "@/components/sanity/SanityImage";

const WEEK: Weekday[] = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

type Schedule = CURRENT_SCHEDULES_QUERY_RESULT[number];

type Props = {
  schedule: Schedule;
  /** Restrict to one church (page-builder section, church page). */
  churchId?: string | null;
  /** Church photographs by id, shown at the top of each card. */
  churchImages?: Map<string, SanityImageValue>;
  showTitle?: boolean;
  /** Hide the church name and the card (when it already sits in a tile on the church's page). */
  compact?: boolean;
};

/**
 * Weekly recurring schedule as one card per church: photograph, name, then
 * weekday rows with big tabular times — the sheet on the church door.
 */
export function ScheduleTable({ schedule, churchId, churchImages, showTitle = true, compact }: Props) {
  const byChurch = [...scheduleByChurch(schedule).values()].filter((b) => !churchId || b.church._id === churchId);
  if (!byChurch.length) return null;
  const range =
    schedule.validFrom || schedule.validUntil
      ? formatDateSpan(schedule.validFrom ?? schedule.validUntil!, schedule.validUntil ?? schedule.validFrom!)
      : null;

  return (
    <div>
      {showTitle ? (
        <div className="mb-6 flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <h3 className="text-[1.5rem] font-bold tracking-[-0.035em]">{schedule.title}</h3>
          {range ? <p className="text-small text-ink-3">velja {range}</p> : null}
        </div>
      ) : null}
      <div className={cn("grid gap-5", !compact && "md:grid-cols-2", byChurch.length > 2 && "xl:grid-cols-3")}>
        {byChurch.map(({ church, days }) => {
          const image = churchImages?.get(church._id);
          return (
            <section
              key={church._id}
              aria-labelledby={`urnik-${schedule._id}-${church._id}`}
              className={compact ? undefined : "overflow-hidden rounded-lg bg-surface shadow-soft"}
            >
              {!compact && hasImage(image) ? (
                <SanityImage image={image} aspect={16 / 7} sizes="(min-width: 768px) 36rem, 100vw" maxWidth={1200} decorative imgClassName="saturate-[.6]" />
              ) : null}
              <div className={compact ? undefined : "p-6 sm:p-7"}>
                {!compact ? (
                  <h4 id={`urnik-${schedule._id}-${church._id}`} className="text-[1.375rem] font-bold leading-tight tracking-[-0.035em]">
                    <Link href={routes.church(church.slug)} className="hover:underline">
                      {church.name}
                    </Link>
                  </h4>
                ) : (
                  <h4 id={`urnik-${schedule._id}-${church._id}`} className="sr-only">
                    {church.name}
                  </h4>
                )}
                <dl className={cn("divide-y divide-stone/70", !compact && "mt-4 border-t border-stone/70")}>
                  {WEEK.filter((d) => days.has(d)).map((weekday) => (
                    <div key={weekday} className="grid grid-cols-[6.5rem_1fr] gap-4 py-3.5">
                      <dt className="pt-0.5 text-body capitalize text-ink-2">{WEEKDAY_LABEL[weekday]}</dt>
                      <dd>
                        <ul className="space-y-1.5">
                          {days.get(weekday)!.map((row) => {
                            const type = clean(row.type);
                            return (
                              <li key={`${row.time}-${row.type}`} className="flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
                                <time dateTime={row.time} className="text-[1.5rem] font-semibold leading-none tracking-[-0.045em] tabular-nums text-ink">
                                  {formatTime(row.time)}
                                </time>
                                {type !== "regular" ? <span className="text-small text-ink-2">{MASS_TYPE_LABEL[type]}</span> : null}
                                {row.note ? <span className="text-small text-ink-3">{row.note}</span> : null}
                              </li>
                            );
                          })}
                        </ul>
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            </section>
          );
        })}
      </div>
      {schedule.note?.length ? <RichText value={schedule.note} size="sm" className="mt-6 text-ink-2" /> : null}
    </div>
  );
}
