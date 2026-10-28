"use client";

import type { Field } from "@/lib/content/fields";
import { Row, useFieldError, type FieldProps } from "../context";

type StringLike = Extract<Field, { kind: "string" }>;
type TextLike = Extract<Field, { kind: "text" }>;
type NumberLike = Extract<Field, { kind: "number" }>;

const str = (v: unknown) => (typeof v === "string" ? v : "");
/** Empty text is not stored (undefined removes the key). */
const orUndef = (s: string) => (s === "" ? undefined : s);

/** One line of text: inline in the row, right-aligned until focused (the prototype's look). */
export function StringField({ field, value, onChange, path }: FieldProps<StringLike>) {
  const { id, error, aria } = useFieldError(path);
  const type = field.format === "email" ? "email" : field.format === "url" ? "url" : "text";
  return (
    <Row label={field.label} htmlFor={id} help={field.help} error={error} errorId={`${id}-err`}>
      <input
        id={id}
        className="vs-in"
        type={type}
        value={str(value)}
        onChange={(e) => onChange(orUndef(e.target.value))}
        aria-required={field.required || undefined}
        autoComplete="off"
        inputMode={type === "email" ? "email" : type === "url" ? "url" : undefined}
        {...aria}
      />
      {field.max ? <Count n={str(value).length} max={field.max} /> : null}
    </Row>
  );
}

/** Several lines (summaries, intros): a sunk text area under the label. */
export function TextField({ field, value, onChange, path }: FieldProps<TextLike>) {
  const { id, error, aria } = useFieldError(path);
  return (
    <Row label={field.label} htmlFor={id} help={field.help} error={error} errorId={`${id}-err`} tall>
      <textarea
        id={id}
        className="vs-ta"
        rows={field.rows ?? 3}
        value={str(value)}
        onChange={(e) => onChange(orUndef(e.target.value))}
        aria-required={field.required || undefined}
        {...aria}
      />
      {field.max ? <Count n={str(value).length} max={field.max} /> : null}
    </Row>
  );
}

export function NumberField({ field, value, onChange, path }: FieldProps<NumberLike>) {
  const { id, error, aria } = useFieldError(path);
  return (
    <Row label={field.label} htmlFor={id} help={field.help} error={error} errorId={`${id}-err`}>
      <input
        id={id}
        className="vs-in num"
        type="number"
        inputMode="numeric"
        min={field.min}
        max={field.max}
        value={typeof value === "number" ? value : ""}
        onChange={(e) => onChange(e.target.value === "" ? undefined : Number(e.target.value))}
        {...aria}
      />
    </Row>
  );
}

/** "48 / 120", turning red past the limit. */
export function Count({ n, max }: { n: number; max: number }) {
  if (n < max * 0.7) return null;
  return (
    <span className={n > max ? "vs-count over" : "vs-count"} aria-live="polite">
      {n} / {max}
    </span>
  );
}
