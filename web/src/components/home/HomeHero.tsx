import type { HOME_PAGE_QUERY_RESULT } from "@/sanity/types.generated";
import type { TodayBlock } from "@/lib/data/today";
import { SanityImage, hasImage } from "@/components/sanity/SanityImage";
import { TodayWidget } from "./TodayWidget";
import s from "./home.module.css";

type Props = { home: HOME_PAGE_QUERY_RESULT; parishName: string; block: TodayBlock };

/**
 * The photograph of the place in a rounded frame, the parish's name on it,
 * and the "Danes" widget docked over its lower edge.
 */
export function HomeHero({ home, parishName, block }: Props) {
  return (
    <section className={s.hero} aria-labelledby="hero-title">
      <div className={s.frame}>
        {hasImage(home?.heroImage) ? (
          <div className={s.ph} aria-hidden="true">
            <SanityImage image={home.heroImage} sizes="100vw" maxWidth={2400} priority quality={80} decorative fill />
          </div>
        ) : null}
        <div className={s.sh} aria-hidden="true" />
        <div className={s.copy}>
          <h1 id="hero-title">
            {home?.heroTitle || parishName}
            <em className="accent">pod Šmarno goro</em>
          </h1>
          <p className={s.lede}>Marijina cerkev, Sv. Križ in Sv. Tomaž. Dobrodošli doma.</p>
        </div>
      </div>
      <div className={s.dock}>
        <TodayWidget block={block} />
      </div>
    </section>
  );
}
