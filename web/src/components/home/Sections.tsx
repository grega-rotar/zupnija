import Link from "next/link";
import type { CHURCHES_QUERY_RESULT, HOME_ARTICLES_QUERY_RESULT, SETTINGS_QUERY_RESULT } from "@/sanity/types.generated";
import { dateOf, formatDayMonth } from "@/lib/dates";
import { routes } from "@/lib/routes";
import { cn } from "@/lib/utils";
import { RichText } from "@/components/sanity/RichText";
import { SanityImage, hasImage, ImagePlaceholder } from "@/components/sanity/SanityImage";
import { Arrow } from "./Arrow";
import s from "./home.module.css";

/** "Iz življenja župnije": the three latest articles. */
export function News({ articles }: { articles: HOME_ARTICLES_QUERY_RESULT }) {
  if (!articles.length) return null;
  return (
    <section className={cn(s.wrap, s.sec)} aria-labelledby="novice-h">
      <div className={cn(s.open, s.reveal)} data-reveal>
        <p className={s.eye}>Novice</p>
        <h2 className={s.h2} id="novice-h">
          Iz <em className="accent">življenja</em> župnije
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
                <SanityImage image={a.image} sizes="(min-width: 900px) 400px, 100vw" maxWidth={900} decorative fill />
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

type Church = Pick<CHURCHES_QUERY_RESULT[number], "_id" | "name" | "shortName" | "slug" | "dedication" | "image">;

/** "Naše cerkve": the churches as photographs. */
export function Churches({ churches }: { churches: Church[] }) {
  if (!churches.length) return null;
  const n = churches.length;
  return (
    <section className={cn(s.wrap, s.sec)} aria-labelledby="cerkve-h">
      <div className={cn(s.open, s.reveal)} data-reveal>
        <p className={s.eye}>Cerkve</p>
        <h2 className={s.h2} id="cerkve-h">
          Naše <em className="accent">cerkve</em>
        </h2>
        <p className={s.subl}>{n === 3 ? "Tri cerkve" : n === 2 ? "Dve cerkvi" : `${n} cerkva`} pod Šmarno goro.</p>
      </div>
      <div className={s.churches}>
        {churches.slice(0, 3).map((c) => (
          <Link key={c._id} className={cn(s.church, s.reveal)} href={routes.church(c.slug)} data-reveal>
            {hasImage(c.image) ? (
              <div className={s.ph} aria-hidden="true">
                <SanityImage image={c.image} sizes="(min-width: 900px) 400px, 100vw" maxWidth={1000} decorative fill />
              </div>
            ) : null}
            <div className={s.txt}>
              <h3>{c.shortName || c.name}</h3>
              <p>{c.shortName && c.name !== c.shortName ? c.name : c.dedication}</p>
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

/** "Podprite župnijo": the bank details from Sanity settings.donations; hidden without an IBAN. */
export function Giving({ donations }: { donations: NonNullable<SETTINGS_QUERY_RESULT>["donations"] | null | undefined }) {
  if (!donations?.iban) return null;
  const rows = [
    { label: "Prejemnik", value: donations.recipient },
    { label: "TRR (IBAN)", value: donations.iban },
    { label: "BIC", value: donations.bic },
    { label: "Sklic", value: donations.reference },
    { label: "Namen", value: donations.purpose },
  ].filter((r): r is { label: string; value: string } => Boolean(r.value));
  return (
    <section className={cn(s.wrap, s.sec)} id="darovi" aria-labelledby="darovi-h">
      <div className={cn(s.open, s.reveal)} data-reveal>
        <p className={s.eye}>Darovi</p>
        <h2 className={s.h2} id="darovi-h">
          Podprite <em className="accent">župnijo</em>
        </h2>
        <p className={s.subl}>Vaš dar pomaga pri skrbi za cerkve in življenje župnije.</p>
      </div>
      <div className={s.give}>
        <div className={cn(s.giveTile, s.reveal)} data-reveal>
          <p className={s.kick}>Darovi</p>
          <h3 className={s.gt}>
            Dar z <em className="accent">nakazilom</em>
          </h3>
          {donations.intro?.length ? (
            <RichText value={donations.intro} size="sm" className={s.gp} />
          ) : (
            <p className={s.gp}>Nakažete ga lahko v spletni ali mobilni banki.</p>
          )}
          <div className={s.trr}>
            <dl>
              {rows.map((r) => (
                <div key={r.label}>
                  <dt>{r.label}</dt>
                  <dd>{r.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </div>
    </section>
  );
}
