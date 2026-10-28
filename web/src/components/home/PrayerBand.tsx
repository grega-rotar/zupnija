import Link from "next/link";
import { getPrayerPage, prayerItemLine } from "@/lib/prayer/page";
import { routes } from "@/lib/routes";
import { cn } from "@/lib/utils";
import { SanityImage, hasImage } from "@/components/sanity/SanityImage";
import { Arrow } from "./Arrow";
import s from "./home.module.css";
import p from "./PrayerBand.module.css";

/**
 * "Pridite pred Najsvetejše" (tasks/proto-v4/partials/b.html, US-012): the
 * candles photograph with the prayer times the priest marked "Prikaži na
 * domači strani". The photo is prayerPage.image, else the candles. Hidden
 * when no item is marked.
 */
export async function PrayerBand() {
  const page = await getPrayerPage();
  const items = page?.items.filter((i) => i.onHome) ?? [];
  if (!page || !items.length) return null;
  return (
    <section className={cn(s.wrap, s.sec)} aria-labelledby="molitev-h">
      <div className={cn(p.band, s.reveal)} data-reveal>
        {hasImage(page.image) ? (
          <div className={p.ph} aria-hidden="true">
            <SanityImage image={page.image} sizes="(min-width: 1240px) 1192px, 100vw" maxWidth={2000} decorative fill />
          </div>
        ) : (
          <div className={cn(p.ph, p.candles)} aria-hidden="true" />
        )}
        <div className={p.shade} aria-hidden="true" />
        <div>
          <p className={p.eye}>{page.title || "Molitev in češčenje"}</p>
          <h2 className={cn(s.h2, p.h2)} id="molitev-h">
            Pridite pred <em className="accent">Najsvetejše</em>
          </h2>
        </div>
        <div className={p.foot}>
          <ul className={p.times}>
            {items.map((i) => (
              <li key={i._key}>
                <b>{i.title}</b>
                <span>{prayerItemLine(i)}</span>
              </li>
            ))}
          </ul>
          <Link className={p.more} href={routes.prayer}>
            Vsi časi molitve <Arrow size={13} />
          </Link>
        </div>
      </div>
    </section>
  );
}
