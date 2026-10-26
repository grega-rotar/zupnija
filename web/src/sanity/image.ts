import { createImageUrlBuilder, type SanityImageSource } from "@sanity/image-url";
import { dataset, projectId } from "./env";

const builder = createImageUrlBuilder({ projectId, dataset });

/** Sanity image URL builder; honours hotspot/crop automatically. */
export function urlFor(source: SanityImageSource) {
  return builder.image(source).auto("format");
}
