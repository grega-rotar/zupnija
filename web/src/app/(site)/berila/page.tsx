import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSettings } from "@/sanity/data";
import { today } from "@/lib/clock";
import { addDays, formatDayHeading, isIsoDate, relativeDayLabel, type IsoDate } from "@/lib/dates";
import { getLiturgicalDay, type LiturgicalDay } from "@/lib/liturgy/day";
import { hozanaUrl } from "@/lib/liturgy/hozana";
import type { ReadingPart } from "@/lib/liturgy/readings";
import { getReadings, type Readings } from "@/lib/liturgy/readings-data";
import { buildMetadata } from "@/lib/seo";
import { routes } from "@/lib/routes";
import { cn } from "@/lib/utils";
import { Icon } from "@/components/ui/Icon";
import { Button, Container, PageHeader, Section, TextLink, tile } from "@/components/ui/primitives";

type Props = { searchParams: Promise<{ datum?: string }> };

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const [settings, { datum }] = await Promise.all([getSettings(), searchParams]);
  const date = isIsoDate(datum) ? datum : today();
  return buildMetadata({
    settings,
    title: `Berila · ${formatDayHeading(date, true)}`,
    description: "Božja beseda dneva: berilo, psalm in evangelij. Vir: hozana.si.",
    path: isIsoDate(datum) ? routes.readingsOn(datum) : routes.readings,
  });
}

const navButton =
  "inline-flex min-h-11 items-center gap-1.5 rounded-full bg-surface px-4 text-[0.9375rem] font-semibold text-ink shadow-soft transition-colors hover:bg-paper-2";

const capitalise = (x: string) => x.charAt(0).toUpperCase() + x.slice(1);

/**
 * The day's readings (US-003) from hozana.si, `?datum=YYYY-MM-DD` for another
 * day. Without HOZANA_API_KEY (or far from today) the page shows the
 * liturgical day and links the readings on hozana.si; the source is always
 * credited.
 */
export default async function ReadingsPage({ searchParams }: Props) {
  const { datum } = await searchParams;
  if (datum !== undefined && !isIsoDate(datum)) redirect(routes.readings);
  const t = today();
  const date: IsoDate = datum ?? t;
  // One after the other: the second finds the first's fetch in the cache.
  const liturgy = await getLiturgicalDay(date);
  const readings = await getReadings(date, t);
  const near = date >= addDays(t, -1) && date <= addDays(t, 1);

  return (
    <>
      <PageHeader title="Berila dneva" accent="dneva" lede={`${near ? `${relativeDayLabel(date, t)} · ` : ""}${formatDayHeading(date, true)}`}>
        <nav aria-label="Izbira dneva" className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link href={routes.readingsOn(addDays(date, -1))} className={navButton}>
            <Icon name="arrow-left" size={16} />
            Prejšnji dan
          </Link>
          {date !== t ? (
            <Link href={routes.readings} className="inline-flex min-h-11 items-center px-2 text-[0.9375rem] font-semibold text-gold-ink hover:text-moss-deep">
              Danes
            </Link>
          ) : null}
          <Link href={routes.readingsOn(addDays(date, 1))} className={navButton}>
            Naslednji dan
            <Icon name="arrow-right" size={16} />
          </Link>
        </nav>
      </PageHeader>

      <Section>
        <Container width="prose" className="grid gap-5">
          <DayTile date={date} liturgy={liturgy} readings={readings} />
          {readings.available ? (
            readings.readings.map((r) => <ReadingTile key={r.label} reading={r} />)
          ) : (
            <Fallback date={date} reason={readings.reason} />
          )}
          <p className="pt-3 text-center text-small text-ink-3">
            Vir:{" "}
            <a href={hozanaUrl(date)} target="_blank" rel="noopener noreferrer" className="font-semibold text-gold-ink underline-offset-4 hover:underline">
              hozana.si
            </a>
          </p>
        </Container>
      </Section>
    </>
  );
}

/** The liturgical day: rank, title, Sunday name and the Gospel line. */
function DayTile({ date, liturgy, readings }: { date: IsoDate; liturgy: LiturgicalDay | null; readings: Readings }) {
  const title = liturgy?.title ?? (readings.available ? readings.title : null);
  const rank = liturgy?.rank ?? (readings.available ? readings.rank : null);
  const line = liturgy?.gospelLine ?? (readings.available ? readings.gospelLine : null);
  if (!title && !line) return null;
  // "»…« (Lk 6,13)": the reference set apart from the line.
  const verse = line?.match(/^(.*?)\s*(?:\(([^()]+)\))?$/);
  return (
    <div className={cn(tile, "p-6 text-center sm:p-10")}>
      <p className="eyebrow">{rank ? capitalise(rank) : formatDayHeading(date)}</p>
      {title ? <h2 className="mx-auto mt-3 max-w-[30rem] text-balance text-[clamp(1.75rem,1.4rem+1.6vw,2.5rem)] font-bold leading-[1.05] tracking-[-0.04em]">{title}</h2> : null}
      {liturgy?.sundayName && liturgy.sundayName !== title ? <p className="mt-2 text-small font-medium text-ink-3">{liturgy.sundayName}</p> : null}
      {verse ? (
        <p className="mx-auto mt-5 max-w-[34rem] text-balance font-serif text-[1.375rem] italic leading-snug text-ink-2">
          {verse[1]}
          {verse[2] ? <span className="mt-1.5 block font-sans text-[0.8125rem] font-semibold not-italic text-gold-ink">{verse[2]}</span> : null}
        </p>
      ) : null}
    </div>
  );
}

function ReadingTile({ reading: r }: { reading: ReadingPart }) {
  const psalm = r.label === "Psalm";
  return (
    <article className={cn(tile, "p-6 sm:p-10")} aria-labelledby={`berilo-${r.label}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 id={`berilo-${r.label}`} className="text-[0.8125rem] font-semibold uppercase tracking-[0.08em] text-gold-ink">
          {r.label}
        </h2>
        {r.ref ? <p className="tnum text-small font-semibold text-ink-3">{r.ref}</p> : null}
      </div>
      {r.title ? <h3 className="mt-3 text-[1.5rem] font-bold leading-[1.15] tracking-[-0.035em]">{r.title}</h3> : null}
      {r.intro ? <p className="mt-1.5 text-small italic text-ink-3">{r.intro}</p> : null}
      {r.acclamation ? (
        <p className="mt-4 rounded-md bg-paper-2 px-4 py-3 text-small text-ink-2">
          <span className="font-semibold text-gold-ink">Aleluja.</span> {r.acclamation} <span className="font-semibold text-gold-ink">Aleluja.</span>
        </p>
      ) : null}
      {r.response ? (
        <p className="mt-4 font-serif text-[1.375rem] italic leading-snug text-ink">
          <span className="mr-2 font-sans text-[0.8125rem] font-semibold not-italic text-gold-ink">Odpev</span>»{r.response}«
        </p>
      ) : null}
      <div className={cn("mt-5 grid gap-4 text-[1.0625rem] leading-[1.65] text-ink", psalm && "gap-5")}>
        {r.text.map((p, i) => (
          <p key={i} className={cn("whitespace-pre-line", psalm && "pl-4 shadow-[inset_2px_0_0_var(--color-gold-soft)]")}>
            {p}
          </p>
        ))}
      </div>
    </article>
  );
}

/** No key, a day far from today, or hozana down: what to do instead. */
function Fallback({ date, reason }: { date: IsoDate; reason: "link" | "unavailable" }) {
  const url = hozanaUrl(date);
  if (reason === "unavailable") {
    return (
      <div className={cn(tile, "p-6 text-center sm:p-10")}>
        <p className="text-body text-ink-2">Berila so ta trenutek nedosegljiva.</p>
        <TextLink href={url} external className="mt-2">
          Odpri na hozana.si
        </TextLink>
      </div>
    );
  }
  return (
    <div className={cn(tile, "p-6 text-center sm:p-10")}>
      <ul className="mx-auto flex max-w-md flex-wrap justify-center gap-2" aria-label="Berila pri sveti maši">
        {["Berilo", "Psalm", "Evangelij"].map((x) => (
          <li key={x} className="inline-flex h-8 items-center rounded-full bg-paper-2 px-3.5 text-[0.8125rem] font-semibold text-ink-2">
            {x}
          </li>
        ))}
      </ul>
      <p className="mx-auto mt-5 max-w-[28rem] text-balance text-body text-ink-2">Berilo, psalm in evangelij tega dne so v celoti objavljeni na spletni strani hozana.si.</p>
      <Button href={url} external icon="external" className="mt-6">
        Preberi berila na hozana.si
      </Button>
    </div>
  );
}
