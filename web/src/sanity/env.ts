/**
 * The Sanity project and dataset the website's content came from. Asset ids
 * and /media URLs keep Sanity's shape (/media/images/<project>/<dataset>/…),
 * so @sanity/image-url builds them; the values are only path segments now.
 * Safe to import from client components.
 */
export const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID || "hnwav9pa";

export const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET || "production";
