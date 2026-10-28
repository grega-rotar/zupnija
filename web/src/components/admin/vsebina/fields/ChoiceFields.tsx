"use client";

import { Icon } from "@/components/admin/Icon";
import { ChipGroup, IconButton } from "@/components/admin/ui";
import type { Field } from "@/lib/content/fields";
import { Row, useFieldError, type FieldProps } from "../context";

type BooleanLike = Extract<Field, { kind: "boolean" }>;
type SelectLike = Extract<Field, { kind: "select" }>;
type GeoLike = Extract<Field, { kind: "geopoint" }>;
type StringsLike = Extract<Field, { kind: "strings" }>;

/** A switch row: label (and hint) on the left, the real 51×31 switch on the right. */
export function BooleanField({ field, value, onChange, path }: FieldProps<BooleanLike>) {
  const { id } = useFieldError(path);
  return (
    <label className="vs-r switch">
      <div>
        <b>{field.label}</b>
        {field.help ? <small>{field.help}</small> : null}
      </div>
      <input id={id} type="checkbox" role="switch" checked={value === true} onChange={(e) => onChange(e.target.checked)} />
    </label>
  );
}

/** Up to three choices (or `layout: "radio"`) are pills; longer lists a native select. */
export function SelectField({ field, value, onChange, path }: FieldProps<SelectLike>) {
  const { id, error, aria } = useFieldError(path);
  const v = typeof value === "string" ? value : "";
  const pills = field.layout === "radio" || field.options.length <= 3;
  if (pills) {
    return (
      <Row label={field.label} help={field.help} error={error} errorId={`${id}-err`} tall={field.options.some((o) => o.label.length > 18)}>
        <ChipGroup label={field.label} options={field.options.map((o) => [o.value, o.label] as const)} value={v} onChange={(x) => onChange(x)} className="vs-chips" />
      </Row>
    );
  }
  const known = !v || field.options.some((o) => o.value === v);
  return (
    <Row label={field.label} htmlFor={id} help={field.help} error={error} errorId={`${id}-err`}>
      <span className="vs-sel">
        <select id={id} value={v} onChange={(e) => onChange(e.target.value || undefined)} aria-required={field.required || undefined} {...aria}>
          <option value="">{field.required ? "Izberite …" : "—"}</option>
          {known ? null : <option value={v}>{v}</option>}
          {field.options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <Icon name="down" />
      </span>
    </Row>
  );
}

/** Sanity geopoint {_type:"geopoint", lat, lng}: two numbers and a link to check it on the map. */
export function GeopointField({ field, value, onChange, path }: FieldProps<GeoLike>) {
  const { id, error } = useFieldError(path);
  const g = (value ?? {}) as { lat?: number; lng?: number };
  const set = (k: "lat" | "lng", s: string) => {
    const next = { _type: "geopoint", lat: g.lat, lng: g.lng, [k]: s === "" ? undefined : Number(s) };
    onChange(next.lat == null && next.lng == null ? undefined : next);
  };
  return (
    <Row label={field.label} help={field.help} error={error} errorId={`${id}-err`} tall>
      <div className="vs-geo">
        <label className="field">
          <span>Zemljepisna širina</span>
          <input id={id} type="number" step="any" inputMode="decimal" value={g.lat ?? ""} onChange={(e) => set("lat", e.target.value)} placeholder="46.12" />
        </label>
        <label className="field">
          <span>Zemljepisna dolžina</span>
          <input type="number" step="any" inputMode="decimal" value={g.lng ?? ""} onChange={(e) => set("lng", e.target.value)} placeholder="14.44" />
        </label>
      </div>
      {g.lat != null && g.lng != null ? (
        <a className="vs-link" href={`https://www.openstreetmap.org/?mlat=${g.lat}&mlon=${g.lng}#map=17/${g.lat}/${g.lng}`} target="_blank" rel="noreferrer">
          Preveri na zemljevidu
        </a>
      ) : null}
    </Row>
  );
}

/** A list of short lines (sacrament requirements, documents needed): plain strings, no keys. */
export function StringsField({ field, value, onChange, path }: FieldProps<StringsLike>) {
  const { id, error } = useFieldError(path);
  const list = Array.isArray(value) ? (value as string[]) : [];
  const set = (next: string[]) => onChange(next.length ? next : undefined);
  return (
    <Row label={field.label} help={field.help} error={error} errorId={`${id}-err`} tall>
      <ul className="vs-lines">
        {list.map((s, i) => (
          <li key={i}>
            <input
              id={i === 0 ? id : undefined}
              className="vs-box"
              value={s}
              aria-label={`${field.label}, vrstica ${i + 1}`}
              onChange={(e) => set(list.map((x, j) => (j === i ? e.target.value : x)))}
            />
            <IconButton icon="x" label={`Odstrani vrstico ${i + 1}`} onClick={() => set(list.filter((_, j) => j !== i))} />
          </li>
        ))}
      </ul>
      <button type="button" className="vs-add" onClick={() => set([...list, ""])}>
        <Icon name="plus" />
        Dodaj vrstico
      </button>
    </Row>
  );
}
