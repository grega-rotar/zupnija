"use client";

import { slugify, type Field } from "@/lib/content/fields";
import { Row, useFieldError, type FieldProps } from "../context";

type SlugLike = Extract<Field, { kind: "slug" }>;

/** Stored as {_type:"slug", current}. "Iz naslova" makes it from the source field. */
export function SlugField({ field, value, onChange, path, parent }: FieldProps<SlugLike>) {
  const { id, error, aria } = useFieldError(path);
  const current = (value as { current?: string } | undefined)?.current ?? "";
  const source = typeof parent?.[field.source] === "string" ? (parent[field.source] as string) : "";
  const set = (s: string) => onChange(s ? { _type: "slug", current: s } : undefined);
  const made = slugify(source, field.max);
  return (
    <Row label={field.label} htmlFor={id} help={field.help} error={error} errorId={`${id}-err`}>
      <span className="vs-slug">
        <input
          id={id}
          className="vs-in"
          value={current}
          onChange={(e) => set(e.target.value.toLowerCase().replace(/\s+/g, "-"))}
          onBlur={() => current && set(slugify(current, field.max))}
          spellCheck={false}
          autoComplete="off"
          aria-required={field.required || undefined}
          {...aria}
        />
      </span>
      {made && made !== current ? (
        <button type="button" className="vs-link" onClick={() => set(made)}>
          Iz naslova
        </button>
      ) : null}
    </Row>
  );
}
