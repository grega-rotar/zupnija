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
      <PageHeader title="Berila dneva">
        <p className="mt-5 text-small font-medium text-ink-3">{`${near ? `${relativeDayLabel(date, t)} · ` : ""}${formatDayHeading(date, true)}`}</p>
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
          <DayTile liturgy={liturgy} readings={readings} />
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
function DayTile({ liturgy, readings }: { liturgy: LiturgicalDay | null; readings: Readings }) {
  const title = liturgy?.title ?? (readings.available ? readings.title : null);
  const rank = liturgy?.rank ?? (readings.available ? readings.rank : null);
  const line = liturgy?.gospelLine ?? (readings.available ? readings.gospelLine : null);
  if (!title && !line) return null;
  // "»…« (Lk 6,13)": the reference set apart from the line.
  const verse = line?.match(/^(.*?)\s*(?:\(([^()]+)\))?$/);
  return (
    <div className={cn(tile, "p-6 text-center sm:p-10")}>
      {title ? <h2 className="mx-auto max-w-[30rem] text-balance text-h3">{title}</h2> : null}
      {rank || (liturgy?.sundayName && liturgy.sundayName !== title) ? (
        <p className={cn("text-small font-medium text-ink-3", title && "mt-2")}>
          {[rank ? capitalise(rank) : null, liturgy?.sundayName && liturgy.sundayName !== title ? liturgy.sundayName : null].filter(Boolean).join(" · ")}
        </p>
      ) : null}
      {verse ? (
        <p className="mx-auto mt-5 max-w-[34rem] text-balance text-[1.25rem] font-medium leading-snug tracking-[-0.02em] text-ink-2">
          {verse[1]}
          {verse[2] ? <span className="mt-1.5 block text-[0.8125rem] font-semibold tracking-normal text-gold-ink">{verse[2]}</span> : null}
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
        <h2 id={`berilo-${r.label}`} className="text-h3">
          {r.label}
        </h2>
        {r.ref ? <p className="tnum text-small font-semibold text-ink-3">{r.ref}</p> : null}
      </div>
      {r.title ? <p className="mt-1.5 text-body font-semibold text-ink-2">{r.title}</p> : null}
      {r.intro ? <p className="mt-1.5 text-small italic text-ink-3">{r.intro}</p> : null}
      {r.acclamation ? (
        <p className="mt-4 rounded-md bg-paper-2 px-4 py-3 text-small text-ink-2">
          <span className="font-semibold text-gold-ink">Aleluja.</span> {r.acclamation} <span className="font-semibold text-gold-ink">Aleluja.</span>
        </p>
      ) : null}
      {r.response ? (
        <p className="mt-4 text-[1.25rem] font-medium leading-snug tracking-[-0.02em] text-ink">
          <span className="mr-2 text-[0.8125rem] font-semibold tracking-normal text-gold-ink">Odpev</span>»{r.response}«
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
