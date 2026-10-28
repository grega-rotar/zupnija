"use client";

import { useEffect, useRef } from "react";
import { Icon } from "@/components/ui/Icon";
import type { FormResult } from "@/lib/forms/public";

/*
 * The public forms' fields, in the contact form's look (ContactForm.tsx):
 * sunk paper inputs, a gold ring on focus, the error under the field. For
 * forms that use src/lib/forms/public.ts with useActionState.
 */

export const inputClass =
  "block w-full min-w-0 rounded-sm border-0 bg-paper-2 px-4 py-3 text-body text-ink shadow-[inset_0_0_0_1px_rgb(31_28_24/0.06)] placeholder:text-ink-3 transition-[background-color,box-shadow] " +
  "focus:bg-surface focus:shadow-[inset_0_0_0_1px_var(--color-gold)] focus:outline-none focus-visible:outline-3 focus-visible:outline-gold/40 focus-visible:outline-offset-2 " +
  "aria-[invalid=true]:shadow-[inset_0_0_0_1.5px_var(--color-alert)]";

/** A form's current values: the echo after an error, else the defaults. */
export function valueOf(state: FormResult | null, name: string, fallback = ""): string {
  const v = state?.values?.[name];
  return typeof v === "string" ? v : Array.isArray(v) ? (v[0] ?? fallback) : fallback;
}

export function valuesOf(state: FormResult | null, name: string): string[] {
  const v = state && !state.ok ? state.values?.[name] : undefined;
  return Array.isArray(v) ? v : typeof v === "string" && v ? [v] : [];
}

export const errorOf = (state: FormResult | null, name: string) => (state && !state.ok ? state.fieldErrors[name] : undefined);

export function FieldError({ id, text }: { id: string; text?: string }) {
  if (!text) return null;
  return (
    <p id={id} className="mt-1 flex items-center gap-1 text-small text-alert">
      <Icon name="alert" size={16} className="shrink-0" />
      {text}
    </p>
  );
}

type Common = {
  id: string;
  name: string;
  label: string;
  error?: string;
  hint?: string;
  required?: boolean;
  className?: string;
};

function Label({ id, label, required }: { id: string; label: string; required?: boolean }) {
  return (
    <label htmlFor={id} className="mb-1.5 block text-small font-medium text-ink">
      {label}
      {!required ? <span className="font-normal text-ink-3"> (neobvezno)</span> : null}
    </label>
  );
}

function describedBy(id: string, error?: string, hint?: string) {
  return [error ? `${id}-error` : null, hint ? `${id}-hint` : null].filter(Boolean).join(" ") || undefined;
}

function Hint({ id, hint }: { id: string; hint?: string }) {
  return hint ? (
    <p id={`${id}-hint`} className="mt-1 text-meta text-ink-3">
      {hint}
    </p>
  ) : null;
}

/** A text input (or a textarea with `rows`). Uncontrolled: `defaultValue` + a `key` to reset. */
export function TextField({
  id,
  name,
  label,
  error,
  hint,
  required,
  className,
  rows,
  ...rest
}: Common & { rows?: number } & Omit<React.InputHTMLAttributes<HTMLInputElement>, "id" | "name">) {
  const aria = { "aria-invalid": error ? true : undefined, "aria-describedby": describedBy(id, error, hint) };
  return (
    <div className={className}>
      <Label id={id} label={label} required={required} />
      {rows ? (
        <textarea
          id={id}
          name={name}
          rows={rows}
          required={required}
          maxLength={rest.maxLength}
          defaultValue={rest.defaultValue as string | undefined}
          placeholder={rest.placeholder}
          className={inputClass}
          {...aria}
        />
      ) : (
        <input id={id} name={name} required={required} className={inputClass} {...rest} {...aria} />
      )}
      <Hint id={id} hint={hint} />
      <FieldError id={`${id}-error`} text={error} />
    </div>
  );
}

export function SelectField({
  id,
  name,
  label,
  error,
  hint,
  required,
  className,
  options,
  placeholder,
  ...rest
}: Common & { options: { value: string; label: string }[]; placeholder?: string } & Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "id" | "name">) {
  return (
    <div className={className}>
      <Label id={id} label={label} required={required} />
      <select
        id={id}
        name={name}
        required={required}
        className={`${inputClass} appearance-none bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2216%22 height=%2216%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22%236b6358%22 stroke-width=%222%22><path d=%22m6 9 6 6 6-6%22/></svg>')] bg-[length:1rem] bg-[right_1rem_center] bg-no-repeat pr-10`}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, error, hint)}
        {...rest}
      >
        {placeholder != null ? <option value="">{placeholder}</option> : null}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <Hint id={id} hint={hint} />
      <FieldError id={`${id}-error`} text={error} />
    </div>
  );
}

/** One checkbox with its label (and an error, for "rules accepted"). */
export function CheckField({
  id,
  name,
  value,
  label,
  error,
  defaultChecked,
}: {
  id: string;
  name: string;
  value?: string;
  label: React.ReactNode;
  error?: string;
  defaultChecked?: boolean;
}) {
  return (
    <div>
      <label htmlFor={id} className="flex cursor-pointer items-start gap-3 rounded-sm py-1 text-body text-ink-2">
        <input
          id={id}
          type="checkbox"
          name={name}
          value={value}
          defaultChecked={defaultChecked}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          className="mt-1 size-5 shrink-0 cursor-pointer rounded-[6px] accent-[var(--color-moss)] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-gold/40"
        />
        <span>{label}</span>
      </label>
      <FieldError id={`${id}-error`} text={error} />
    </div>
  );
}

/** The honeypot: hidden from people, filled by bots (src/lib/forms/public.ts). */
export function Honeypot({ id }: { id: string }) {
  return (
    <div className="absolute -left-[9999px] top-auto h-px w-px overflow-hidden" aria-hidden="true">
      <label htmlFor={`${id}-website`}>Spletna stran</label>
      <input id={`${id}-website`} name="website" type="text" tabIndex={-1} autoComplete="off" />
    </div>
  );
}

/** The form-level error ("Preverite označena polja." …), focused when it appears. */
export function FormError({ state }: { state: FormResult | null }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (state && !state.ok) ref.current?.focus();
  }, [state]);
  if (!state || state.ok) return null;
  return (
    <div ref={ref} tabIndex={-1} role="alert" className="flex items-start gap-2 rounded-md bg-alert-soft p-4 text-body text-alert outline-none">
      <Icon name="alert" size={20} className="mt-0.5 shrink-0" />
      {state.message}
    </div>
  );
}

/** The success panel that replaces the form. */
export function FormSuccess({ message, children }: { message: string; children?: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => ref.current?.focus(), []);
  return (
    <div ref={ref} tabIndex={-1} role="status" className="rounded-md bg-gold-soft p-5 outline-none sm:p-6">
      <p className="flex items-start gap-2.5 text-body text-ink">
        <Icon name="check" size={22} className="mt-0.5 shrink-0 text-gold-ink" />
        <span>{message}</span>
      </p>
      {children ? <div className="mt-4 pl-8">{children}</div> : null}
    </div>
  );
}

/** A titled group of fields inside a form. */
export function Fieldset({ legend, sub, children }: { legend: string; sub?: string; children: React.ReactNode }) {
  return (
    <fieldset className="min-w-0 border-t border-stone/70 pt-6 first:border-t-0 first:pt-0">
      <legend className="float-left w-full text-[1.125rem] font-bold tracking-[-0.025em] text-ink">{legend}</legend>
      {sub ? <p className="clear-both pt-1 text-small text-ink-2">{sub}</p> : null}
      <div className="clear-both space-y-5 pt-4">{children}</div>
    </fieldset>
  );
}
