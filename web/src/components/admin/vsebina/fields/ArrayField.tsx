"use client";

import { useState } from "react";
import { Icon } from "@/components/admin/Icon";
import { IconButton } from "@/components/admin/ui";
import { initialValues, SECTION_GROUPS, type ArrayItem, type Field } from "@/lib/content/fields";
import { Row, useFieldError, useForm, type FieldProps } from "../context";
import { newKey, pathKey } from "../doc";
import { FieldList } from "../FieldView";
import { ImageField, previewSrc } from "./ImageField";
import { assetUrl, type ImageValue } from "./ImageField.media";

type ArrayLike = Extract<Field, { kind: "array" }>;
type ImagesLike = Extract<Field, { kind: "images" }>;
type Item = Record<string, unknown> & { _key: string; _type: string };

/** Move item i by d (-1 up, +1 down). */
function moved<T>(list: T[], i: number, d: -1 | 1): T[] {
  const next = [...list];
  [next[i], next[i + d]] = [next[i + d], next[i]];
  return next;
}

/** A short line for a closed item: its first text-like value, else the item type. */
function summary(item: Item, of: ArrayItem | undefined): string {
  for (const k of ["title", "label", "question", "name"]) {
    if (typeof item[k] === "string" && (item[k] as string).trim()) return item[k] as string;
  }
  if (typeof item.weekday === "string") {
    const day = of?.fields.find((f) => f.name === "weekday");
    const label = day?.kind === "select" ? day.options.find((o) => o.value === item.weekday)?.label : item.weekday;
    return [label, item.from && item.to ? `${item.from}–${item.to}` : null].filter(Boolean).join(" ");
  }
  if (typeof item.platform === "string") {
    const p = of?.fields.find((f) => f.name === "platform");
    return (typeof item.label === "string" && item.label) || (p?.kind === "select" ? p.options.find((o) => o.value === item.platform)?.label : null) || item.platform;
  }
  return of?.label ?? "Vnos";
}

/**
 * A list of objects (links, attachments, FAQ, page sections …). Each item
 * keeps its _key and _type; add (choosing the type when there are several,
 * grouped as in the studio's insert menu), open to edit, move up/down, remove.
 */
export function ArrayField({ field, value, onChange, path }: FieldProps<ArrayLike>) {
  const { id, error } = useFieldError(path);
  const { errors } = useForm();
  const items = Array.isArray(value) ? (value as Item[]) : [];
  const [open, setOpen] = useState<Set<string>>(() => new Set(items.length === 1 ? [items[0]._key] : []));
  const [choosing, setChoosing] = useState(false);
  const set = (next: Item[]) => onChange(next.length ? next : undefined);
  const ofType = (it: Item) => field.of.find((o) => o.type === it._type) ?? (field.of.length === 1 ? field.of[0] : undefined);
  const toggle = (key: string, on: boolean) =>
    setOpen((s) => {
      const n = new Set(s);
      if (on) n.add(key);
      else n.delete(key);
      return n;
    });

  function add(of: ArrayItem) {
    const item: Item = { _key: newKey(), _type: of.type, ...initialValues(of.fields) };
    set([...items, item]);
    toggle(item._key, true);
    setChoosing(false);
  }

  const full = field.max != null && items.length >= field.max;
  const rank = (g: string) => (SECTION_GROUPS.includes(g) ? SECTION_GROUPS.indexOf(g) : SECTION_GROUPS.length);
  const groups = [...new Set(field.of.map((o) => o.group ?? ""))].sort((a, b) => rank(a) - rank(b));
  const noun = field.of.length === 1 ? field.of[0].label.toLowerCase() : "odsek";

  return (
    <Row label={field.label} help={field.help} error={error} errorId={`${id}-err`} tall>
      {items.length ? (
        <ol className="vs-items">
          {items.map((it, i) => {
            const of = ofType(it);
            const at = [...path, i];
            const bad = Object.keys(errors).some((k) => k.startsWith(pathKey(at) + "."));
            const isOpen = open.has(it._key) || bad;
            return (
              <li key={it._key} className={bad ? "bad" : undefined}>
                <div className="vs-item-h">
                  <button type="button" className="vs-item-t" aria-expanded={isOpen} onClick={() => toggle(it._key, !isOpen)} id={i === 0 ? id : undefined}>
                    <Icon name={isOpen ? "down" : "r"} />
                    <span>
                      <b>{summary(it, of)}</b>
                      {field.of.length > 1 ? <small>{of?.label ?? it._type}</small> : null}
                    </span>
                  </button>
                  <IconButton icon="upc" label="Premakni gor" disabled={i === 0} onClick={() => set(moved(items, i, -1))} />
                  <IconButton icon="down" label="Premakni dol" disabled={i === items.length - 1} onClick={() => set(moved(items, i, 1))} />
                  <IconButton icon="trash" label={`Odstrani: ${summary(it, of)}`} onClick={() => set(items.filter((_, j) => j !== i))} />
                </div>
                {isOpen && of ? (
                  <div className="vs-sub">
                    <FieldList
                      fields={of.fields}
                      value={it}
                      onChange={(v) => set(items.map((x, j) => (j === i ? ({ ...(v ?? {}), _key: it._key, _type: it._type } as Item) : x)))}
                      path={at}
                    />
                  </div>
                ) : null}
              </li>
            );
          })}
        </ol>
      ) : null}
      {full ? null : field.of.length === 1 ? (
        <button type="button" className="vs-add" onClick={() => add(field.of[0])}>
          <Icon name="plus" />
          Dodaj: {noun}
        </button>
      ) : (
        <div className="vs-insert">
          <button type="button" className="vs-add" aria-expanded={choosing} onClick={() => setChoosing((c) => !c)}>
            <Icon name="plus" />
            Dodaj odsek
          </button>
          {choosing ? (
            <div className="vs-menu" role="group" aria-label="Vrsta odseka" onKeyDown={(e) => e.key === "Escape" && setChoosing(false)}>
              {groups.map((g) => (
                <div key={g}>
                  {g ? <p>{g}</p> : null}
                  {field.of
                    .filter((o) => (o.group ?? "") === g)
                    .map((o) => (
                      <button type="button" key={o.type} onClick={() => add(o)}>
                        {o.label}
                      </button>
                    ))}
                </div>
              ))}
            </div>
          ) : null}
        </div>
      )}
    </Row>
  );
}

/** A list of imageWithAlt items (galleries): thumbnails that open into the image editor, and an upload tile to add one. */
export function ImagesField({ field, value, onChange, path }: FieldProps<ImagesLike>) {
  const { id, error } = useFieldError(path);
  const items = Array.isArray(value) ? (value as Array<ImageValue & { _key: string }>) : [];
  const [openKey, setOpenKey] = useState<string | null>(null);
  const set = (next: typeof items) => onChange(next.length ? next : undefined);

  return (
    <Row label={field.label} help={field.help} error={error} errorId={`${id}-err`} tall>
      {items.length ? (
        <ol className="vs-thumbs">
          {items.map((it, i) => {
            const src = previewSrc(assetUrl(it.asset?._ref) ?? undefined, 240);
            const isOpen = openKey === it._key;
            return (
              <li key={it._key} className={isOpen ? "open" : undefined}>
                <button type="button" className="vs-thumb" aria-expanded={isOpen} onClick={() => setOpenKey(isOpen ? null : it._key)} aria-label={`Slika ${i + 1}: ${it.alt || "brez opisa"}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element -- our own /media route */}
                  {src ? <img src={src} alt="" /> : null}
                </button>
                <span className="vs-thumb-acts">
                  <IconButton icon="l" label="Premakni levo" disabled={i === 0} onClick={() => set(moved(items, i, -1))} />
                  <IconButton icon="r" label="Premakni desno" disabled={i === items.length - 1} onClick={() => set(moved(items, i, 1))} />
                </span>
                {isOpen ? (
                  <div className="vs-thumb-ed">
                    <ImageField
                      label={`Slika ${i + 1}`}
                      value={it}
                      caption
                      type="imageWithAlt"
                      onChange={(v) => set(v ? items.map((x, j) => (j === i ? { ...v, _key: it._key } : x)) : items.filter((_, j) => j !== i))}
                    />
                  </div>
                ) : null}
              </li>
            );
          })}
        </ol>
      ) : null}
      <ImageField
        id={id}
        label={`${field.label}: dodaj`}
        value={null}
        type="imageWithAlt"
        error={null}
        onChange={(v) => v && set([...items, { ...v, _key: newKey() }])}
      />
    </Row>
  );
}
