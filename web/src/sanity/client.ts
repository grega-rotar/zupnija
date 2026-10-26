import { createClient } from "next-sanity";
import { apiVersion, dataset, projectId, studioUrl } from "./env";

/**
 * Public read client. Published content only, served from the CDN.
 * Draft/preview access is added by `defineLive` in live.ts using a
 * server-only token.
 */
export const client = createClient({
  projectId,
  dataset,
  apiVersion,
  useCdn: true,
  stega: { studioUrl },
});
