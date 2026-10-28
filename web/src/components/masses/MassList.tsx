import Link from "next/link";
import {
  compareTime,
  formatDayNumber,
  formatMonthShort,
  formatTime,
  formatWeekdayShort,
  relativeDayLabel,
  WEEKDAY_LABEL,
  weekdayOf,
  type IsoDate,
} from "@/lib/dates";
import { dayLines, INTENTION_PREFIX, MASS_TYPE_LABEL, type Mass, type MassDay } from "@/lib/masses";
import { routes } from "@/lib/routes";
import { clean } from "@/lib/clean";
import { cn } from "@/lib/utils";
import { RichText } from "@/components/sanity/RichText";

type Tone = "paper" | "ink";

export { dayLines };

/** Title, Sunday name and Gospel line of a day, as small text under a heading. */
export function DayTitle({ day, tone = "paper", className }: { day: Pick<MassDay, "liturgicalTitle" | "sundayName" | "gospel">; tone?: Tone; className?: string }) {
  const { title, sunday, gospel } = dayLines(day);
  if (!title && !gospel) return null;
  const dark = tone === "ink";
  return (
    <div className={cn("mt-1 text-small", dark ? "text-paper/70" : "text-ink-2", className)}>
      {title ? <p>{title}</p> : null}
      {sunday ? <p className={dark ? "text-paper/60" : "text-ink-3"}>{sunday}</p> : null}
      {gospel ? <p className={cn("font-serif italic", dark ? "text-paper/60" : "text-ink-3")}>{gospel}</p> : null}
    </div>
  );
}

type MassRowProps = {
  mass: Mass;
  showIntentions?: boolean;
  /** Larger type for featured blocks. */
  size?: "md" | "lg";
  tone?: Tone;
  /** Leave out the church pill (on the church's own page). */
  hideChurch?: boolean;
};

/**
 * One Mass: a large tabular time, what, where. Intentions underneath when
 * requested. Cancelled Masses stay visible, struck through *and* labelled.
 */
export function MassRow({ mass, showIntentions, size = "md", tone = "paper", hideChurch }: MassRowProps) {
  const status = clean(mass.status);
  const cancelled = status === "cancelled";
  const changed = status === "changed";
  const typeLabel = MASS_TYPE_LABEL[clean(mass.type)] ?? MASS_TYPE_LABEL.regular;
  const churchName = mass.church?.shortName ?? mass.church?.name;
  const dark = tone === "ink";

  return (
    <li
      className={cn(
        "grid gap-x-5 py-4",
        size === "lg" ? "grid-cols-[5.5rem_1fr] sm:grid-cols-[7rem_1fr] sm:py-5" : "grid-cols-[4.75rem_1fr]",
      )}
    >
      <time
        dateTime={mass.time}
        className={cn(
          "whitespace-nowrap font-semibold leading-none tracking-[-0.045em] tabular-nums",
          size === "lg" ? "text-[2rem] sm:text-[2.5rem]" : "text-[1.5rem]",
          cancelled ? (dark ? "text-paper/40 line-through decoration-1" : "text-ink-3 line-through decoration-1") : dark ? "text-paper" : "text-ink",
        )}
      >
        {formatTime(mass.time)}
      </time>
      <div className={cn("min-w-0", size === "lg" ? "pt-1 sm:pt-2" : "pt-0.5")}>
        <p className={cn("flex flex-wrap items-center gap-x-2.5 gap-y-1.5", size === "lg" ? "text-lede" : "text-body")}>
          <span className={cn("font-semibold tracking-[-0.015em]", cancelled && (dark ? "text-paper/50 line-through" : "text-ink-3 line-through"))}>{typeLabel}</span>
          {churchName && !hideChurch ? <ChurchPill name={churchName} slug={mass.church?.slug} dark={dark} muted={cancelled} /> : null}
          {cancelled ? <StatusPill tone="alert" dark={dark}>Odpade</StatusPill> : null}
          {changed ? <StatusPill tone="gold" dark={dark}>Sprememba</StatusPill> : null}
        </p>
        {mass.statusNote ? <p className={cn("mt-1.5 text-small", dark ? "text-paper/80" : "text-alert")}>{mass.statusNote}</p> : null}
        {mass.note ? <p className={cn("mt-1.5 text-small", dark ? "text-paper/70" : "text-ink-2")}>{mass.note}</p> : null}
        {mass.celebrant ? (
          <p className={cn("mt-1 text-small", dark ? "text-paper/60" : "text-ink-3")}>
            Mašuje {mass.celebrant.name}
            {mass.celebrant.roleTitle ? `, ${mass.celebrant.roleTitle}` : ""}
          </p>
        ) : null}
        {showIntentions && mass.intentions.length ? (
          <ul className={cn("mt-2.5 space-y-1 text-small", dark ? "text-paper/80" : "text-ink-2")}>
            {mass.intentions.map((i) => {
              const prefix = INTENTION_PREFIX[clean(i.kind) ?? ""];
              return (
                <li key={i._key} className="flex gap-2">
                  <span className={cn("w-3 shrink-0 text-center", dark ? "text-gold" : "text-gold")} aria-label={prefix ? "za pokojne" : undefined} aria-hidden={prefix ? undefined : true}>
                    {prefix ?? "·"}
                  </span>
                  <span>{i.text}</span>
                </li>
              );
            })}
          </ul>
        ) : null}
      </div>
    </li>
  );
}

export function ChurchPill({ name, slug, dark, muted }: { name: string; slug?: string; dark: boolean; muted: boolean }) {
  const classes = cn(
    "inline-flex h-7 items-center rounded-full px-3 text-[0.8125rem] font-semibold leading-none",
    dark ? "bg-paper/15 text-paper/90" : "bg-paper-2 text-ink-2",
    muted && "opacity-60",
    slug && (dark ? "hover:bg-paper/25 hover:text-paper" : "hover:bg-paper-3 hover:text-ink"),
  );
  if (!slug) return <span className={classes}>{name}</span>;
  return (
    <Link href={routes.church(slug)} className={classes}>
      {name}
    </Link>
  );
}

export function StatusPill({ children, tone, dark }: { children: React.ReactNode; tone: "alert" | "gold"; dark: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex h-7 items-center rounded-full px-3 text-[0.8125rem] font-semibold leading-none",
        tone === "alert" && (dark ? "bg-alert text-paper" : "bg-alert-soft text-alert"),
        tone === "gold" && (dark ? "bg-gold text-ink" : "bg-gold-soft text-gold-ink"),
      )}
    >
      {children}
    </span>
  );
}

/** Calendar page for a day: the month on a gold-brown band, the big number, the weekday. */
export function DayLeaf({ date, tone = "paper", size = "md" }: { date: IsoDate; tone?: Tone; size?: "md" | "lg" }) {
  const dark = tone === "ink";
  return (
    <div
      className={cn(
        "flex shrink-0 flex-col overflow-hidden text-center leading-none",
        size === "lg" ? "w-[4.5rem] rounded-[1.25rem] sm:w-20" : "w-14 rounded-[0.875rem]",
        dark ? "bg-paper/10 text-paper shadow-[inset_0_0_0_1px_rgb(255_255_255/0.15)]" : "bg-surface text-ink shadow-soft",
      )}
    >
      <span className={cn("bg-moss font-bold uppercase tracking-[0.08em] text-paper", size === "lg" ? "py-1 text-[0.6875rem]" : "py-[3px] text-[0.625rem]")}>
        {formatMonthShort(date)}
      </span>
      <span className={cn("font-bold tabular-nums tracking-[-0.05em]", size === "lg" ? "pt-1.5 text-[2.25rem] sm:text-[2.5rem]" : "pt-1 text-[1.5rem]")}>
        {formatDayNumber(date)}
      </span>
      <span className={cn("font-medium", size === "lg" ? "pb-2 pt-0.5 text-[0.75rem]" : "pb-1.5 pt-0.5 text-[0.6875rem]", dark ? "text-paper/70" : "text-ink-3")}>
        {formatWeekdayShort(date)}
      </span>
    </div>
  );
}

type DayCardProps = {
  day: MassDay;
  masses?: Mass[];
  today: IsoDate;
  showIntentions?: boolean;
  size?: "md" | "lg";
  tone?: Tone;
  headingLevel?: "h2" | "h3";
  /** Override the heading, e.g. "Danes" / "Jutri". */
  label?: string;
  /** No box: for lists of days set one under another. */
  plain?: boolean;
  className?: string;
};

/**
 * One day as a card: calendar leaf, weekday, liturgical title, then the
 * Masses. Empty days are explained rather than left blank.
 */
export function DayCard({ day, masses, today, showIntentions, size = "md", tone = "paper", headingLevel: Heading = "h3", label, plain, className }: DayCardProps) {
  const list = masses ?? day.masses;
  const dark = tone === "ink";
  const weekday = WEEKDAY_LABEL[weekdayOf(day.date)];
  const relative = relativeDayLabel(day.date, today);
  const heading = label ?? (relative === "Danes" || relative === "Jutri" ? relative : weekday.charAt(0).toUpperCase() + weekday.slice(1));

  return (
    <section
      aria-labelledby={`dan-${day.date}`}
      className={cn(
        !plain && "rounded-lg",
        !plain && (dark ? "bg-paper/[0.06] shadow-[inset_0_0_0_1px_rgb(255_255_255/0.1)]" : "bg-surface shadow-soft"),
        !plain && (size === "lg" ? "p-6 sm:p-8" : "p-5 sm:p-7"),
        className,
      )}
    >
      <div className={cn("flex items-center gap-4 border-b pb-5", dark ? "border-paper/15" : "border-stone/70")}>
        <DayLeaf date={day.date} tone={tone} size={size} />
        <div className="min-w-0">
          <Heading id={`dan-${day.date}`} className={cn("font-bold leading-tight", size === "lg" ? "text-[2rem] tracking-[-0.045em]" : "text-[1.375rem] tracking-[-0.035em]", dark ? "text-paper" : "text-ink")}>
            {heading}
          </Heading>
          <DayTitle day={day} tone={tone} />
        </div>
      </div>
      {list.length ? (
        <ul className={cn("divide-y", dark ? "divide-paper/10" : "divide-stone/70")}>
          {list.map((m) => (
            <MassRow key={m.key} mass={m} showIntentions={showIntentions} size={size} tone={tone} />
          ))}
        </ul>
      ) : (
        <p className={cn("py-5 text-body", dark ? "text-paper/60" : "text-ink-3")}>Ta dan ni svete maše.</p>
      )}
      {day.note?.length ? (
        <RichText value={day.note} size="sm" className={cn("mt-2 border-t pt-3", dark ? "border-paper/15 text-paper/70" : "border-stone/70 text-ink-2")} />
      ) : null}
    </section>
  );
}

/**
 * The week as a plain list: day on the left, times on the right. Reads
 * like the sheet on the church door; needs no boxes.
 */
export function WeekGrid({ days, today, time, tone = "paper" }: { days: MassDay[]; today: IsoDate; time?: string; tone?: Tone }) {
  const dark = tone === "ink";
  return (
    <ol className={cn("divide-y border-t", dark ? "divide-paper/10 border-paper/10" : "divide-stone/70 border-stone/70")}>
      {days.map((day) => {
        const isToday = day.date === today;
        return (
          <li key={day.date} className="grid grid-cols-[4.5rem_1fr] gap-x-4 py-3">
            <div className={cn("leading-tight", isToday ? (dark ? "text-gold" : "text-gold-ink") : dark ? "text-paper/60" : "text-ink-3")}>
              <span className="block text-meta font-semibold">{isToday ? "danes" : formatWeekdayShort(day.date)}</span>
              <span className={cn("block text-[1.375rem] font-bold tabular-nums tracking-[-0.04em]", dark ? "text-paper" : "text-ink")}>{formatDayNumber(day.date)}.</span>
            </div>
            <ul className="min-w-0 space-y-0.5 pt-0.5">
              {day.masses.length ? (
                day.masses.map((m) => {
                  const cancelled = clean(m.status) === "cancelled";
                  const past = isToday && !!time && compareTime(m.time, time) < 0;
                  return (
                    <li key={m.key} className={cn("text-body", cancelled && "line-through opacity-50", past && !cancelled && "opacity-45")}>
                      <span className={cn("tnum font-semibold", dark ? "text-paper" : "text-ink")}>{formatTime(m.time)}</span>
                      <span className={dark ? "text-paper/60" : "text-ink-2"}> {m.church?.shortName}</span>
                      {cancelled ? <span className="inline-block no-underline"> — odpade</span> : null}
                      {past && !cancelled ? <span className="text-meta"> · minilo</span> : null}
                    </li>
                  );
                })
              ) : (
                <li className={cn("text-body", dark ? "text-paper/40" : "text-ink-3")}>—</li>
              )}
              {dayLines(day).title ? <li className={cn("text-meta", dark ? "text-paper/50" : "text-ink-3")}>{dayLines(day).title}</li> : null}
              {dayLines(day).gospel ? <li className={cn("font-serif text-meta italic", dark ? "text-paper/50" : "text-ink-3")}>{dayLines(day).gospel}</li> : null}
            </ul>
          </li>
        );
      })}
    </ol>
  );
}
