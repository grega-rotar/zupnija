/**
 * Public Sanity configuration. Only NEXT_PUBLIC_* values live here so this
 * module is safe to import from client components. Secrets stay in
 * server-only modules (see token.ts).
 */

function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(
      `Manjka okoljska spremenljivka ${name}. Preverite web/.env.local (glej .env.example).`,
    );
  }
  return value;
}

export const projectId = required(
  "NEXT_PUBLIC_SANITY_PROJECT_ID",
  process.env.NEXT_PUBLIC_SANITY_PROJECT_ID,
);

export const dataset = required(
  "NEXT_PUBLIC_SANITY_DATASET",
  process.env.NEXT_PUBLIC_SANITY_DATASET,
);

/** Dated API version — keep hard-coded so query behaviour is stable. */
export const apiVersion = "2026-09-14";

/** Standalone Studio URL, used for Visual Editing overlays. */
export const studioUrl =
  process.env.NEXT_PUBLIC_SANITY_STUDIO_URL || "http://localhost:3333";
