import Link from "next/link";
import type { GALLERIES_QUERY_RESULT } from "@/sanity/types.generated";
import { formatDate } from "@/lib/dates";
import { routes } from "@/lib/routes";
import { cn } from "@/lib/utils";
import { SanityImage, hasImage, ImagePlaceholder } from "@/components/sanity/SanityImage";
import { tile, tileHover } from "@/components/ui/primitives";

type Gallery = GALLERIES_QUERY_RESULT[number];

/** Gallery tile: cover photo, date and photo count, title. */
export function GalleryCard({ gallery }: { gallery: Gallery }) {
  return (
    <Link href={routes.gallery(gallery.slug)} className={cn(tile, tileHover, "group flex flex-col overflow-hidden no-underline")}>
      <div className="overflow-hidden bg-paper-2">
        {hasImage(gallery.cover) ? (
          <SanityImage
            image={gallery.cover}
            aspect={4 / 3}
            sizes="(min-width: 1024px) 24rem, (min-width: 640px) 50vw, 100vw"
            maxWidth={900}
            decorative
            imgClassName="saturate-[.7] transition-transform duration-[800ms] ease-out-soft group-hover:scale-[1.03] motion-reduce:transform-none"
          />
        ) : (
          <ImagePlaceholder className="aspect-[4/3]" />
        )}
      </div>
      <div className="px-7 pb-7 pt-6">
        <p className="text-[0.8125rem] font-semibold text-ink-3">
          {formatDate(gallery.date)}
          {gallery.count ? ` · ${gallery.count} fotografij` : ""}
        </p>
        <h3 className="mt-2 text-[1.375rem] font-bold leading-[1.15] tracking-[-0.035em] text-ink">{gallery.title}</h3>
      </div>
    </Link>
  );
}
