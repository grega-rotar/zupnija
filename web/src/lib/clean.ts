/**
 * Stripped Sanity's Visual Editing markers from strings used for logic. The
 * content comes from Postgres now and carries none, so this is the identity;
 * callers keep it as a marker of "compared, not rendered".
 */
export function clean<T extends string | null | undefined>(value: T): T {
  return value;
}
