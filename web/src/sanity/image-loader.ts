import type { ImageLoaderProps } from "next/image";

/**
 * Global `next/image` loader (next.config `images.loaderFile`).
 * Sanity's CDN resizes and converts images itself, so we only rewrite the
 * `w`/`h`/`q` parameters of the URL that `SanityImage` prepared (which
 * already carries the hotspot crop). Non-Sanity sources are returned as-is.
 */
export default function sanityImageLoader({ src, width, quality }: ImageLoaderProps): string {
  if (!src.startsWith("https://cdn.sanity.io/")) return src;
  const url = new URL(src);
  const w = Number(url.searchParams.get("w"));
  const h = Number(url.searchParams.get("h"));
  if (w && h) url.searchParams.set("h", String(Math.round((h * width) / w)));
  url.searchParams.set("w", String(width));
  url.searchParams.set("q", String(quality ?? 78));
  url.searchParams.set("auto", "format");
  return url.toString();
}
