import { DayCard } from "@/components/masses/MassList";
import { Container, Notice, PageHeader, Section } from "@/components/ui/primitives";
import { getMassWeek } from "@/lib/data/masses";
import { formatWeekSpan, startOfWeek, today, type IsoDate } from "@/lib/dates";

/**
 * "Na strani" on Maše in nameni: the public Mašni nameni page for the week
 * of `date`, built from the same data (getMassWeek: published only) and the
 * same components as app/(site)/masni-nameni/page.tsx. Only the week links
 * are left out (they would leave the editor); the week span stays.
 * Server component: rendered by the page and handed to WeekView.
 */
export async function SitePreview({ date }: { date: IsoDate }) {
  const t = today();
  const week = await getMassWeek(date);
  const isCurrent = week.from === startOfWeek(t);
  const hasAnyIntentions = week.days.some((d) => d.hasExplicitDay);

  return (
    <div className="site-preview">
      <PageHeader title="Mašni nameni" lede="Svete maše in nameni po dnevih. Nameni so vpisani za tekoči in prihodnji teden.">
        <p className="mt-8 min-w-0 font-serif text-h3 text-ink">
          {formatWeekSpan(week.from, week.to)}
          {isCurrent ? <span className="ml-2 text-small text-ink-3">ta teden</span> : null}
        </p>
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
    </div>
  );
}
