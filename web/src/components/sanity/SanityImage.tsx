import Image from "next/image";
import { urlFor } from "@/sanity/image";
import { cn } from "@/lib/utils";
import { ChurchMark } from "@/components/ui/ChurchMark";

/** Shape returned by `imageFragment`. */
export type SanityImageValue = {
  asset?: {
    _id: string;
    url: string;
    metadata?: {
      lqip?: string | null;
      dimensions?: { width: number; height: number; aspectRatio: number } | null;
    } | null;
  } | null;
  alt?: string | null;
  caption?: string | null;
  hotspot?: unknown;
  crop?: unknown;
} | null | undefined;

type Props = {
  image: SanityImageValue;
  /** Rendered aspect ratio, e.g. 16/9. Omit to keep the original ratio. */
  aspect?: number;
  /** `sizes` attribute — always pass it; it drives which width is downloaded. */
  sizes: string;
  /** Largest width (px) the image is ever rendered at. */
  maxWidth?: number;
  priority?: boolean;
  className?: string;
  imgClassName?: string;
  /** Use when the image is purely decorative and described nearby. */
  decorative?: boolean;
  quality?: number;
  /** Cover the positioned parent completely (hero backgrounds, tiles). */
  fill?: boolean;
};

export function hasImage(image: SanityImageValue): image is NonNullable<SanityImageValue> & { asset: NonNullable<NonNullable<SanityImageValue>["asset"]> } {
  return Boolean(image?.asset?._id);
}

/** Stand-in for a missing photo in image grids, so cards keep one height. */
export function ImagePlaceholder({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center justify-center bg-paper-3", className)} aria-hidden="true">
      <ChurchMark className="h-12 w-auto text-stone-2" />
    </div>
  );
}

/**
 * Responsive image served straight from the Sanity CDN (see next.config
 * `images.loaderFile`). Hotspot and crop are honoured, so a pastor can upload
 * a huge phone photo and the site downloads only what each screen needs.
 */
export function SanityImage({
  image,
  aspect,
  sizes,
  maxWidth = 1600,
  priority,
  className,
  imgClassName,
  decorative,
  quality = 78,
  fill,
}: Props) {
  if (!hasImage(image)) return null;

  const dims = image.asset.metadata?.dimensions;
  const naturalRatio = dims?.aspectRatio && dims.aspectRatio > 0 ? dims.aspectRatio : 3 / 2;
  const ratio = aspect ?? naturalRatio;
  const width = Math.min(maxWidth, dims?.width ?? maxWidth);
  const height = Math.round(width / ratio);

  const src = urlFor(image).width(width).height(height).fit("crop").quality(quality).url();
  const alt = decorative ? "" : image.alt ?? "";

  return (
    <div
      className={cn("overflow-hidden bg-paper-3", fill ? "absolute inset-0" : "relative", className)}
      style={fill ? undefined : { aspectRatio: `${ratio}` }}
    >
      <Image
        src={src}
        alt={alt}
        width={width}
        height={height}
        sizes={sizes}
        priority={priority}
        loading={priority ? undefined : "lazy"}
        placeholder={image.asset.metadata?.lqip ? "blur" : "empty"}
        blurDataURL={image.asset.metadata?.lqip ?? undefined}
        className={cn("h-full w-full object-cover", imgClassName)}
      />
    </div>
  );
}

/** Image with optional caption below. */
export function Figure(props: Props & { captionClassName?: string }) {
  const { image, captionClassName, ...rest } = props;
  if (!hasImage(image)) return null;
  return (
    <figure>
      <SanityImage image={image} {...rest} />
      {image.caption ? (
        <figcaption className={cn("mt-2 text-meta text-ink-3", captionClassName)}>{image.caption}</figcaption>
      ) : null}
    </figure>
  );
}
