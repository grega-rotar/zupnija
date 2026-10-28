"use client";

import { useId, useMemo, useRef, useState } from "react";
import type { RefOption } from "@/app/admin/(app)/vsebina/queries";
import { Icon } from "@/components/admin/Icon";
import { IconButton } from "@/components/admin/ui";
import { isContentType, TYPES, type Field } from "@/lib/content/fields";
import { Row, useFieldError, useForm, type FieldProps } from "../context";
import { newKey } from "../doc";

type RefLike = Extract<Field, { kind: "reference" }>;
type Ref = { _type: "reference"; _ref: string; _key?: string };

/** Targets that live in their own editor screens, not in the content table. */
const ELSEWHERE: Record<string, string> = {
  event: "Dogodke urejate v razdelku Dogodki; povezava z dogodkom tu še ni mogoča.",
  massSchedule: "Urnike maš urejate v razdelku Maše in nameni; povezava tu še ni mogoča.",
};

/**
 * A reference ({_type:"reference", _ref}) or, with `many`, a list of them,
 * chosen with a searchable picker among the documents of the allowed types.
 */
export function ReferenceField({ field, value, onChange, path }: FieldProps<RefLike>) {
  const { id, error } = useFieldError(path);
  const { refs } = useForm();
  const own = field.to.filter(isContentType);
  const options = useMemo(() => refs.filter((r) => (own as string[]).includes(r.type)), [refs, own]);
  const byId = useMemo(() => new Map(refs.map((r) => [r.id, r])), [refs]);
  const note = own.length ? null : field.to.map((t) => ELSEWHERE[t]).find(Boolean);

  const list: Ref[] = field.many ? (Array.isArray(value) ? (value as Ref[]) : []) : value && (value as Ref)._ref ? [value as Ref] : [];
  const setList = (next: Ref[]) => onChange(field.many ? (next.length ? next : undefined) : next[0]);
  const add = (r: RefOption) =>
    setList(field.many ? [...list, { _type: "reference", _ref: r.id, _key: newKey() }] : [{ _type: "reference", _ref: r.id }]);
  const move = (i: number, d: -1 | 1) => {
    const next = [...list];
    [next[i], next[i + d]] = [next[i + d], next[i]];
    setList(next);
  };

  const chosen = new Set(list.map((r) => r._ref));
  const showPicker = !note && (field.many || list.length === 0);
  return (
    <Row label={field.label} help={note ?? field.help} error={error} errorId={`${id}-err`} tall={field.many || !!note}>
      {list.length ? (
        <ul className="vs-refs">
          {list.map((r, i) => {
            const o = byId.get(r._ref);
            return (
              <li key={r._key ?? r._ref}>
                <span className="vs-ref-t">
                  <b>{o?.title ?? (note ? "Povezano" : "Ni več na voljo")}</b>
                  {o ? <small>{o.subtitle}</small> : null}
                </span>
                {field.many && list.length > 1 ? (
                  <>
                    <IconButton icon="upc" label={`Premakni gor: ${o?.title ?? ""}`} disabled={i === 0} onClick={() => move(i, -1)} />
                    <IconButton icon="down" label={`Premakni dol: ${o?.title ?? ""}`} disabled={i === list.length - 1} onClick={() => move(i, 1)} />
                  </>
                ) : null}
                <IconButton icon="x" label={`Odstrani: ${o?.title ?? "povezavo"}`} onClick={() => setList(list.filter((_, j) => j !== i))} />
              </li>
            );
          })}
        </ul>
      ) : null}
      {showPicker ? (
        <RefPicker
          id={id}
          label={field.label}
          options={options.filter((o) => !chosen.has(o.id))}
          placeholder={field.many && list.length ? "Dodaj še …" : `Poiščite: ${own.map((t) => TYPES[t].plural.toLowerCase()).join(", ")}`}
          onPick={add}
          invalid={!!error}
        />
      ) : null}
    </Row>
  );
}

/** A combobox: type to filter, arrows to move, Enter to choose. */
function RefPicker({ id, label, options, placeholder, onPick, invalid }: {
  id: string;
  label: string;
  options: RefOption[];
  placeholder: string;
  onPick: (o: RefOption) => void;
  invalid: boolean;
}) {
  const listId = useId();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const needle = q.trim().toLowerCase();
  const shown = (needle ? options.filter((o) => `${o.title} ${o.subtitle}`.toLowerCase().includes(needle)) : options).slice(0, 50);
  const at = Math.min(active, Math.max(shown.length - 1, 0));

  function pick(o: RefOption) {
    onPick(o);
    setQ("");
    setOpen(false);
    input.current?.focus();
  }
  function onKey(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      setOpen(true);
      setActive((a) => Math.max(0, Math.min(shown.length - 1, (open ? a : -1) + (e.key === "ArrowDown" ? 1 : -1))));
    } else if (e.key === "Enter" && open && shown[at]) {
      e.preventDefault();
      pick(shown[at]);
    } else if (e.key === "Escape" && open) {
      e.preventDefault();
      setOpen(false);
    }
  }

  return (
    <div className="vs-pick">
      <span className="vs-pick-in">
        <Icon name="search" />
        <input
          ref={input}
          id={id}
          role="combobox"
          aria-label={label}
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open && shown[at] ? `${listId}-${at}` : undefined}
          aria-invalid={invalid || undefined}
          value={q}
          placeholder={placeholder}
          autoComplete="off"
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
            setActive(0);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={onKey}
        />
      </span>
      {open ? (
        <ul className="vs-pick-list" id={listId} role="listbox" aria-label={label}>
          {shown.length ? (
            shown.map((o, i) => (
              <li
                key={o.id}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={i === at}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(o)}
                onMouseEnter={() => setActive(i)}
              >
                <b>{o.title}</b>
                <small>{o.subtitle}</small>
              </li>
            ))
          ) : (
            <li className="none" role="presentation">
              {options.length ? "Ni zadetkov." : "Ni ničesar za izbiro."}
            </li>
          )}
        </ul>
      ) : null}
    </div>
  );
}
