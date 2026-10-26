import "server-only";

/**
 * Viewer token for draft previews. Optional: without it the site simply
 * shows published content and the Presentation tool cannot preview drafts.
 * Never import this from a client component.
 */
export const readToken = process.env.SANITY_API_READ_TOKEN || undefined;
