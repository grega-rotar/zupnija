"use client";

import type { Field } from "@/lib/content/fields";
import { Row, useFieldError, type FieldProps } from "../context";

type DateLike = Extract<Field, { kind: "date" | "datetime" | "time" }>;

const pad = (n: number) => String(n).padStart(2, "0");

/** ISO datetime → the browser's local "YYYY-MM-DDTHH:mm" for <input type="datetime-local">. */
export function toLocalInput(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Back to ISO (UTC), as Sanity stores datetimes. */
export function fromLocalInput(local: string): string | undefined {
  if (!local) return undefined;
  const d = new Date(local);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}

/** date → "YYYY-MM-DD", time → "HH:mm", datetime → ISO; the browser's own pickers. */
export function DateField({ field, value, onChange, path }: FieldProps<DateLike>) {
  const { id, error, aria } = useFieldError(path);
  const v = typeof value === "string" ? value : "";
  const shown = field.kind === "datetime" ? (v ? toLocalInput(v) : "") : v;
  const type = field.kind === "datetime" ? "datetime-local" : field.kind;
  return (
    <Row label={field.label} htmlFor={id} error={error} errorId={`${id}-err`}>
      <input
        id={id}
        className="vs-in date"
        type={type}
        step={field.kind === "date" ? undefined : 900}
        value={shown}
        onChange={(e) => onChange(field.kind === "datetime" ? fromLocalInput(e.target.value) : e.target.value || undefined)}
        aria-required={field.required || undefined}
        {...aria}
      />
    </Row>
  );
}
