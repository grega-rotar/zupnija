import Link from "next/link";
import type { CHURCHES_QUERY_RESULT } from "@/sanity/types.generated";
import { churchPlace } from "@/lib/churches";
import { routes } from "@/lib/routes";
import { SanityImage, hasImage, ImagePlaceholder } from "@/components/sanity/SanityImage";
import { Icon } from "@/components/ui/Icon";

type Church = Pick<CHURCHES_QUERY_RESULT[number], "_id" | "name" | "shortName" | "slug" | "address" | "image">;

/**
 * Church tile (the homepage's "Naše cerkve"): a tall desaturated photograph
 * with the church's name and, under it, its village (ZUP-15), on a warm
 * shade, and a small glass arrow.
 */
export function ChurchCard({ church, priority }: { church: Church; priority?: boolean }) {
  const title = church.shortName || church.name;
  const sub = churchPlace(church.address);
  return (
    <Link
      href={routes.church(church.slug)}
      className="group relative isolate flex aspect-square items-end overflow-hidden rounded-lg p-7 text-paper no-underline shadow-soft sm:aspect-[4/5]"
    >
      <div className="absolute inset-0 -z-20">
        {hasImage(church.image) ? (
          <SanityImage
            image={church.image}
            fill
            sizes="(min-width: 1024px) 26rem, (min-width: 640px) 50vw, 100vw"
            maxWidth={900}
            priority={priority}
            decorative
            imgClassName="[filter:saturate(.42)_sepia(.16)] transition-transform duration-[900ms] ease-out-soft group-hover:scale-[1.03] motion-reduce:transform-none"
          />
        ) : (
          <ImagePlaceholder className="h-full w-full" />
        )}
      </div>
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-[linear-gradient(180deg,rgb(246_239_223/0.34)_0%,rgb(246_239_223/0)_36%,rgb(14_10_6/0)_44%,rgb(14_10_6/0.8)_100%)]"
      />
      <div className="min-w-0 flex-1 pr-2">
        <h3 className="text-paper">{title}</h3>
        {sub ? <p className="mt-1.5 text-small leading-snug text-paper/90">{sub}</p> : null}
      </div>
      <span
        aria-hidden="true"
        className="absolute right-5 top-5 grid size-10 place-items-center rounded-full bg-paper/20 shadow-[inset_0_0_0_1px_rgb(255_255_255/0.26)] backdrop-blur-xl transition-colors duration-300 group-hover:bg-paper/30"
      >
        <Icon name="arrow-right" size={15} />
      </span>
    </Link>
  );
}
