import { stegaClean } from "next-sanity";

/**
 * Strips Visual Editing markers from a string before it is used for logic
 * (lookups, comparisons, attributes). Rendering text does not need this.
 */
export function clean<T extends string | null | undefined>(value: T): T {
  return value == null ? value : (stegaClean(value) as T);
}
