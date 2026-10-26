import { defineLive } from "next-sanity/live";
import { client } from "./client";
import { readToken } from "./token";

/**
 * `sanityFetch` is the single data-access function for the website.
 * It caches published content and invalidates it automatically when the
 * parish edits something in the Studio (Live Content API), so nobody has to
 * redeploy the site after changing content.
 *
 * `SanityLive` must be rendered once in the root layout.
 */
export const { sanityFetch, SanityLive } = defineLive({
  client,
  serverToken: readToken ?? false,
  // The browser token is only used while Draft Mode is enabled (Presentation
  // tool). A Viewer token is the minimum required and is safe for that use.
  browserToken: readToken ?? false,
});
