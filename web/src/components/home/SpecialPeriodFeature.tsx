import Link from "next/link";
import type { HOME_SPECIAL_PERIOD_QUERY_RESULT } from "@/sanity/types.generated";
import { formatDateSpan } from "@/lib/dates";
import { routes } from "@/lib/routes";
import { truncate } from "@/lib/utils";
import { SanityImage, hasImage } from "@/components/sanity/SanityImage";
import { Container, TextLink } from "@/components/ui/primitives";

export const SEASON_COLOR: Record<string, string> = {
  advent: "var(--color-season-advent)",
  christmas: "var(--color-season-christmas)",
  lent: "var(--color-season-lent)",
  easter: "var(--color-season-easter)",
  pentecost: "var(--color-season-pentecost)",
  marian: "var(--color-season-marian)",
  none: "var(--color-season-none)",
};

/**
 * Active special period (Advent, Christmas, feast …) as one calm feature.
 * The liturgical colour appears as a thin rule only.
 */
export function SpecialPeriodFeature({ period }: { period: HOME_SPECIAL_PERIOD_QUERY_RESULT }) {
  if (!period) return null;
  const href = routes.specialPeriod(period.slug);
  const color = SEASON_COLOR[period.season ?? "none"] ?? SEASON_COLOR.none;
  return (
    <section aria-labelledby="obdobje" className="border-b border-stone">
      <Container className="py-10 sm:py-14">
        <div className="grid gap-6 rounded-md bg-paper-2 p-5 sm:p-8 md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] md:items-center md:gap-10">
          <div style={{ borderColor: color }} className="border-l-[3px] pl-5 md:pl-6">
            <p className="text-small text-ink-3">{formatDateSpan(period.activeFrom, period.activeUntil)}</p>
            <h2 id="obdobje" className="mt-1 text-h2">
              <Link href={href} className="hover:underline">
                {period.title}
              </Link>
            </h2>
            {period.excerpt ? <p className="mt-3 max-w-prose text-body text-ink-2">{truncate(period.excerpt, 220)}</p> : null}
            <div className="mt-4">
              <TextLink href={href}>{period.hasSchedule ? "Program in urnik svetih maš" : "Več"}</TextLink>
            </div>
          </div>
          {hasImage(period.image) ? (
            <SanityImage image={period.image} aspect={4 / 3} sizes="(min-width: 768px) 24rem, 100vw" maxWidth={800} className="rounded-sm" />
          ) : null}
        </div>
      </Container>
    </section>
  );
}
