import { urlFor } from "@/sanity/image";
import { SanityImage, hasImage, type SanityImageValue } from "@/components/sanity/SanityImage";
import { Lightbox, type LightboxPhoto } from "./Lightbox";

type Photo = NonNullable<SanityImageValue> & { _key?: string };

type Props = {
  images: Photo[] | null | undefined;
  title?: string;
  /** `grid` (default) shows every photo; `thumbs` shows a few with a "+N" tile that opens the rest. */
  variant?: "grid" | "thumbs";
  thumbs?: number;
  extra?: number;
};

/**
 * Responsive photo grid with a lightbox. Thumbnails are small; the full
 * image is only requested when opened. Works without JavaScript as a grid.
 */
export function PhotoGrid({ images, title, variant = "grid", thumbs = 3, extra = 0 }: Props) {
  const photos = (images ?? []).filter((p): p is Photo & { asset: NonNullable<Photo["asset"]> } => hasImage(p));
  if (!photos.length) return null;

  const lightboxPhotos: LightboxPhoto[] = photos.map((p, i) => ({
    key: p._key ?? String(i),
    src: urlFor(p).width(1800).fit("max").quality(82).url(),
    alt: p.alt ?? "",
    caption: p.caption ?? null,
    width: p.asset.metadata?.dimensions?.width ?? 1800,
    height: p.asset.metadata?.dimensions?.height ?? 1200,
  }));

  const shown = variant === "thumbs" ? photos.slice(0, thumbs) : photos;

  return (
    <Lightbox photos={lightboxPhotos} label={title ?? "Galerija"}>
      <ul className={variant === "thumbs" ? "grid grid-cols-2 gap-3" : "grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 lg:grid-cols-4"}>
        {shown.map((p, i) => (
          <li key={p._key ?? i}>
            <button
              type="button"
              data-lightbox-index={i}
              className="group block w-full overflow-hidden rounded-sm focus-visible:outline-offset-2"
              aria-label={p.alt ? `Odpri fotografijo: ${p.alt}` : `Odpri fotografijo ${i + 1}`}
            >
              <SanityImage
                image={p}
                aspect={1}
                sizes={variant === "thumbs" ? "10rem" : "(min-width: 1024px) 18rem, (min-width: 640px) 33vw, 50vw"}
                maxWidth={variant === "thumbs" ? 400 : 700}
                decorative
                imgClassName="transition-transform duration-300 ease-out-soft group-hover:scale-[1.03] motion-reduce:transform-none"
              />
            </button>
          </li>
        ))}
        {variant === "thumbs" && extra > 0 ? (
          <li>
            <button
              type="button"
              data-lightbox-index={thumbs}
              className="flex aspect-square w-full flex-col items-center justify-center rounded-sm bg-moss text-paper hover:bg-moss-deep focus-visible:outline-offset-2"
            >
              <span className="font-serif text-[1.75rem] leading-none">+{extra}</span>
              <span className="mt-1 text-small">fotografij</span>
            </button>
          </li>
        ) : null}
      </ul>
    </Lightbox>
  );
}
