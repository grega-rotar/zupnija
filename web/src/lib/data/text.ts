/** Plain text from the editor rendered by components that take Portable Text (RichText). */

export type TextBlock = {
  _type: "block";
  _key: string;
  style: "normal";
  markDefs: never[];
  children: { _type: "span"; _key: string; text: string; marks: never[] }[];
};

export function textBlocks(text: string, keyPrefix = "p"): TextBlock[] {
  return text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p, i) => ({
      _type: "block" as const,
      _key: `${keyPrefix}${i}`,
      style: "normal" as const,
      markDefs: [],
      children: [{ _type: "span" as const, _key: `${keyPrefix}${i}s`, text: p, marks: [] }],
    }));
}
