import Link from "next/link";
import type { GALLERIES_QUERY_RESULT } from "@/sanity/types.generated";
import { formatDate } from "@/lib/dates";
import { routes } from "@/lib/routes";
import { SanityImage, hasImage } from "@/components/sanity/SanityImage";

type Gallery = GALLERIES_QUERY_RESULT[number];

export function GalleryCard({ gallery }: { gallery: Gallery }) {
  return (
    <article className="group">
      <Link href={routes.gallery(gallery.slug)} className="block no-underline">
        {hasImage(gallery.cover) ? (
          <SanityImage image={gallery.cover} aspect={4 / 3} sizes="(min-width: 1024px) 24rem, (min-width: 640px) 50vw, 100vw" maxWidth={900} decorative className="rounded-sm" imgClassName="transition-transform duration-700 ease-out-soft group-hover:scale-[1.02] motion-reduce:transform-none" />
        ) : (
          <div className="aspect-[4/3] rounded-sm bg-paper-2" />
        )}
        <div className="mt-4">
          <p className="text-meta text-ink-3">
            {formatDate(gallery.date)}
            {gallery.count ? ` · ${gallery.count} fotografij` : ""}
          </p>
          <h3 className="mt-0.5 font-serif text-lede text-ink group-hover:underline">{gallery.title}</h3>
        </div>
      </Link>
    </article>
  );
}
