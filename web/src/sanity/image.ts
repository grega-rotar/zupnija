import { createImageUrlBuilder, type SanityImageSource } from "@sanity/image-url";
import { dataset, projectId } from "./env";

/** Images are served by our own /media route (src/app/media/**), which speaks the Sanity CDN's parameters. */
const builder = createImageUrlBuilder({ projectId, dataset, baseUrl: "/media" });

/** Image URL builder; honours hotspot/crop automatically. */
export function urlFor(source: SanityImageSource) {
  return builder.image(source).auto("format");
}
