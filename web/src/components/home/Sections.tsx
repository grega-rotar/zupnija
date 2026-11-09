import Link from "next/link";
import type { CHURCHES_QUERY_RESULT, HOME_ARTICLES_QUERY_RESULT, SETTINGS_QUERY_RESULT } from "@/sanity/types.generated";
import { dateOf, formatDayMonth } from "@/lib/dates";
import { churchPlace } from "@/lib/churches";
import { routes } from "@/lib/routes";
import { cn } from "@/lib/utils";
import { SanityImage, hasImage, ImagePlaceholder } from "@/components/sanity/SanityImage";
import { UpnSlip } from "@/components/giving/UpnSlip";
import { getGiving } from "@/lib/giving/donations";
import { Arrow } from "./Arrow";
import s from "./home.module.css";

/**
 * News and church cards: three columns in the 1240px container (24px padding,
 * 20px gaps) from 901px, one column (100vw minus the padding) below
 * (home.module.css). A 412px phone at 1.75x then downloads 640px, not 768px.
 */
const CARD_SIZES = "(min-width: 1240px) 384px, (min-width: 901px) calc((100vw - 88px) / 3), calc(100vw - 48px)";

/** "Iz življenja župnije": the three latest articles. */
export function News({ articles }: { articles: HOME_ARTICLES_QUERY_RESULT }) {
  if (!articles.length) return null;
  return (
    <section className={cn(s.wrap, s.sec)} aria-labelledby="novice-h">
      <div className={cn(s.open, s.reveal)} data-reveal>
        <h2 className={s.h2} id="novice-h">
          Iz življenja župnije
        </h2>
        <Link className={s.more} href={routes.news}>
          Vse novice <Arrow />
        </Link>
      </div>
      <div className={s.news}>
        {articles.slice(0, 3).map((a) => (
          <Link key={a._id} className={cn(s.card, s.reveal)} href={routes.article(a.slug)} data-reveal>
            <div className={s.img}>
              {hasImage(a.image) ? (
                <SanityImage image={a.image} sizes={CARD_SIZES} maxWidth={900} decorative fill />
              ) : (
                <ImagePlaceholder className="absolute inset-0" />
              )}
            </div>
            <div className={s.body}>
              <time dateTime={a.publishedAt}>{formatDayMonth(dateOf(a.publishedAt))}</time>
              <h3>{a.title}</h3>
              <span className={s.go}>
                Preberi <Arrow size={13} />
              </span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

type Church = Pick<CHURCHES_QUERY_RESULT[number], "_id" | "name" | "shortName" | "slug" | "address" | "image">;

/** "Naše cerkve": the churches as photographs, each with its name and its village (ZUP-15). */
export function Churches({ churches }: { churches: Church[] }) {
  if (!churches.length) return null;
  return (
    <section className={cn(s.wrap, s.sec)} aria-labelledby="cerkve-h">
      <div className={cn(s.open, s.reveal)} data-reveal>
        <h2 className={s.h2} id="cerkve-h">
          Naše cerkve
        </h2>
      </div>
      <div className={s.churches}>
        {churches.slice(0, 3).map((c) => (
          <Link key={c._id} className={cn(s.church, s.reveal)} href={routes.church(c.slug)} data-reveal>
            {hasImage(c.image) ? (
              <div className={s.ph} aria-hidden="true">
                <SanityImage image={c.image} sizes={CARD_SIZES} maxWidth={1000} decorative fill />
              </div>
            ) : null}
            <div className={s.txt}>
              <h3>{c.shortName || c.name}</h3>
              {churchPlace(c.address) ? <p>{churchPlace(c.address)}</p> : null}
            </div>
            <span className={s.arr} aria-hidden="true">
              <Arrow size={15} />
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}

/**
 * "Podprite župnijo" (ZUP-17): one full-width card shaped as a filled-in UPN
 * (components/giving/UpnSlip.tsx), then "Vse o darovih". Hidden without an
 * IBAN. The newsletter signup is only in the footer.
 */
export async function Giving({ donations }: { donations: NonNullable<SETTINGS_QUERY_RESULT>["donations"] | null | undefined }) {
  if (!donations?.iban) return null;
  const giving = await getGiving();
  if (!giving) return null;
  return (
    <section className={cn(s.wrap, s.sec)} id="darovi" aria-labelledby="darovi-h">
      <div className={cn(s.open, s.reveal)} data-reveal>
        <h2 className={s.h2} id="darovi-h">
          Podprite župnijo
        </h2>
        <p className={s.subl}>Vaš dar pomaga pri skrbi za cerkve in življenje župnije.</p>
      </div>
      <div className={cn(s.give, s.reveal)} data-reveal>
        <UpnSlip giving={giving} />
        <Link href={routes.donate} className={s.giveMore}>
          Vse o darovih
          <span aria-hidden="true">→</span>
        </Link>
      </div>
    </section>
  );
}
