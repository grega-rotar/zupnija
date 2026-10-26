import type { Metadata } from "next";
import Link from "next/link";
import { getMassWeek, getSettings } from "@/sanity/data";
import { addDays, formatDateSpan, isIsoDate, startOfWeek, today } from "@/lib/dates";
import { buildMetadata } from "@/lib/seo";
import { routes } from "@/lib/routes";
import { DayCard } from "@/components/masses/MassList";
import { Icon } from "@/components/ui/Icon";
import { Container, Notice, PageHeader, Section } from "@/components/ui/primitives";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSettings();
  return buildMetadata({
    settings,
    title: "Mašni nameni",
    description: "Mašni nameni po dnevih za tekoči teden v župniji Pirniče.",
    path: routes.intentions,
  });
}

type Props = { searchParams: Promise<{ teden?: string }> };

const navButton =
  "inline-flex min-h-11 items-center gap-1.5 rounded-sm border border-stone-2 px-3.5 text-small font-medium text-ink hover:border-ink";

/**
 * Week view of Masses with intentions, Sunday to Saturday, with previous /
 * next week navigation. The week is chosen with `?teden=YYYY-MM-DD`.
 */
export default async function IntentionsPage({ searchParams }: Props) {
  const { teden } = await searchParams;
  const t = today();
  const anchor = isIsoDate(teden) ? teden : t;
  const week = await getMassWeek(anchor);
  const prev = addDays(week.from, -7);
  const next = addDays(week.from, 7);
  const isCurrent = week.from === startOfWeek(t);
  const hasAnyIntentions = week.days.some((d) => d.hasExplicitDay);

  return (
    <>
      <PageHeader title="Mašni nameni" lede="Svete maše in nameni po dnevih. Nameni so vpisani za tekoči in prihodnji teden.">
        <nav aria-label="Izbira tedna" className="mt-8 flex flex-wrap items-center gap-3">
          <Link href={routes.intentionsWeek(prev)} className={navButton}>
            <Icon name="arrow-left" size={16} />
            Prejšnji teden
          </Link>
          <p className="min-w-0 px-1 font-serif text-h3 text-ink">
            {formatDateSpan(week.from, week.to)}
            {isCurrent ? <span className="ml-2 text-small text-ink-3">ta teden</span> : null}
          </p>
          <Link href={routes.intentionsWeek(next)} className={navButton}>
            Naslednji teden
            <Icon name="arrow-right" size={16} />
          </Link>
          {!isCurrent ? (
            <Link href={routes.intentions} className="inline-flex min-h-11 items-center px-2 text-small text-moss underline underline-offset-4">
              Nazaj na ta teden
            </Link>
          ) : null}
        </nav>
      </PageHeader>

      <Section tone="paper-2" tight>
        <Container>
          {!hasAnyIntentions ? (
            <Notice className="mb-8">
              Za ta teden nameni še niso vpisani. Prikazan je redni urnik svetih maš; nameni se objavijo ob nedeljah za prihodnji teden.
            </Notice>
          ) : null}
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {week.days.map((day) => (
              <DayCard key={day.date} day={day} today={t} showIntentions headingLevel="h2" />
            ))}
          </div>
        </Container>
      </Section>
    </>
  );
}
