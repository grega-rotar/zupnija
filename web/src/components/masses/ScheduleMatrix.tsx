import Link from "next/link";
import type { CURRENT_SCHEDULES_QUERY_RESULT } from "@/sanity/types.generated";
import { WEEKDAY_LABEL, formatDateSpan, formatTime, type Weekday } from "@/lib/dates";
import { MASS_TYPE_LABEL, scheduleByChurch, type ScheduleRow } from "@/lib/masses";
import { routes } from "@/lib/routes";
import { clean } from "@/lib/clean";
import { cn } from "@/lib/utils";
import { RichText } from "@/components/sanity/RichText";

const WEEK: Weekday[] = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];

type Schedule = CURRENT_SCHEDULES_QUERY_RESULT[number];

/**
 * The weekly schedule as one table: days down, churches across — the way
 * the sheet on the church door reads. On phones the same data is a list
 * per day so nothing scrolls sideways.
 */
export function ScheduleMatrix({ schedule, showTitle }: { schedule: Schedule; showTitle?: boolean }) {
  const churches = [...scheduleByChurch(schedule).values()];
  if (!churches.length) return null;
  const range =
    schedule.validFrom || schedule.validUntil
      ? formatDateSpan(schedule.validFrom ?? schedule.validUntil!, schedule.validUntil ?? schedule.validFrom!)
      : null;
  const days = WEEK.filter((d) => churches.some((c) => c.days.has(d)));

  return (
    <div>
      {showTitle ? (
        <div className="mb-5 flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <h3 className="text-[1.5rem] font-bold tracking-[-0.035em]">{schedule.title}</h3>
          {range ? <p className="text-small text-ink-3">velja {range}</p> : null}
        </div>
      ) : null}

      {/* Phones: one block per day */}
      <dl className="divide-y divide-stone/70 border-y border-stone/70 md:hidden">
        {days.map((day) => (
          <div key={day} className="grid grid-cols-[6rem_1fr] gap-4 py-3.5">
            <dt className="pt-0.5 text-body capitalize text-ink-2">{WEEKDAY_LABEL[day]}</dt>
            <dd className="space-y-1.5">
              {churches
                .filter((c) => c.days.has(day))
                .map((c) => (
                  <div key={c.church._id} className="flex flex-wrap items-baseline gap-x-2">
                    <Times rows={c.days.get(day)!} />
                    <span className="text-small text-ink-2">{c.church.shortName}</span>
                  </div>
                ))}
            </dd>
          </div>
        ))}
      </dl>

      {/* Larger screens: the matrix */}
      <table className="hidden w-full border-collapse md:table">
        <thead>
          <tr className="text-left">
            <th scope="col" className="rounded-l-full bg-paper-2 px-4 py-3 text-small font-semibold text-ink-3">
              Dan
            </th>
            {churches.map((c, i) => (
              <th key={c.church._id} scope="col" className={cn("bg-paper-2 px-4 py-3 text-small font-semibold text-ink", i === churches.length - 1 && "rounded-r-full")}>
                <Link href={routes.church(c.church.slug)} className="rounded-full hover:text-gold-ink">
                  {c.church.shortName}
                </Link>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-stone/70">
          {days.map((day) => (
            <tr key={day}>
              <th scope="row" className="px-4 py-3.5 text-left text-body font-normal capitalize text-ink-2">
                {WEEKDAY_LABEL[day]}
              </th>
              {churches.map((c) => (
                <td key={c.church._id} className="px-4 py-3.5 align-top">
                  {c.days.has(day) ? <Times rows={c.days.get(day)!} /> : <span className="text-ink-3">—</span>}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      {schedule.note?.length ? (
        <div className="mt-5 rounded-md bg-paper-2 px-5 py-4 text-small text-ink-2">
          <RichText value={schedule.note} size="sm" />
        </div>
      ) : null}
    </div>
  );
}

function Times({ rows }: { rows: ScheduleRow[] }) {
  return (
    <span className="inline-flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
      {rows.map((r) => {
        const type = clean(r.type);
        return (
          <span key={`${r.time}-${r.type}`} className="inline-flex flex-wrap items-baseline gap-x-1.5">
            <time dateTime={r.time} className="tnum text-body font-semibold text-ink">
              {formatTime(r.time)}
            </time>
            {type !== "regular" ? <span className="text-meta text-ink-3">{MASS_TYPE_LABEL[type]}</span> : null}
            {r.note ? <span className="text-meta text-ink-3">{r.note}</span> : null}
          </span>
        );
      })}
    </span>
  );
}
