import type { ImageLoaderProps } from "next/image";

/**
 * Global `next/image` loader (next.config `images.loaderFile`).
 * Our /media route resizes and converts images itself (the Sanity CDN's
 * parameters), so we only rewrite the `w`/`h`/`q` parameters of the URL that
 * `SanityImage` prepared (which already carries the hotspot crop). Other
 * sources are returned as-is.
 */
export default function mediaImageLoader({ src, width, quality }: ImageLoaderProps): string {
  const media = src.startsWith("/media/images/");
  if (!media && !src.startsWith("https://cdn.sanity.io/")) return src;
  const url = new URL(src, "http://local");
  const w = Number(url.searchParams.get("w"));
  const h = Number(url.searchParams.get("h"));
  if (w && h) url.searchParams.set("h", String(Math.round((h * width) / w)));
  url.searchParams.set("w", String(width));
  url.searchParams.set("q", String(quality ?? 70));
  url.searchParams.set("auto", "format");
  return media ? `${url.pathname}${url.search}` : url.toString();
}
