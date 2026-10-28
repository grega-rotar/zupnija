"use client";

import { useActionState, useEffect, useId, useRef } from "react";
import { buttonClassName } from "@/components/ui/primitives";
import { Icon } from "@/components/ui/Icon";
import { submitContactForm, type ContactFormState } from "./actions";

const initial: ContactFormState = { status: "idle" };

const inputClass =
  "block w-full rounded-sm border-0 bg-paper-2 px-4 py-3 text-body text-ink shadow-[inset_0_0_0_1px_rgb(31_28_24/0.06)] placeholder:text-ink-3 transition-[background-color,box-shadow] " +
  "focus:bg-surface focus:shadow-[inset_0_0_0_1px_var(--color-gold)] focus:outline-none focus-visible:outline-3 focus-visible:outline-gold/40 focus-visible:outline-offset-2 " +
  "aria-[invalid=true]:shadow-[inset_0_0_0_1.5px_var(--color-alert)]";

type FieldProps = {
  id: string;
  label: string;
  name: "name" | "email" | "phone" | "subject" | "message";
  error?: string;
  hint?: string;
  required?: boolean;
  type?: string;
  autoComplete?: string;
  inputMode?: "text" | "email" | "tel";
  defaultValue?: string;
  textarea?: boolean;
};

function Field({ id, label, name, error, hint, required, type = "text", autoComplete, inputMode, defaultValue, textarea }: FieldProps) {
  const describedBy = [error ? `${id}-error` : null, hint ? `${id}-hint` : null].filter(Boolean).join(" ") || undefined;
  const common = {
    id,
    name,
    required,
    autoComplete,
    defaultValue,
    "aria-invalid": error ? true : undefined,
    "aria-describedby": describedBy,
    className: inputClass,
  };
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-small font-medium text-ink">
        {label}
        {!required ? <span className="font-normal text-ink-3"> (neobvezno)</span> : null}
      </label>
      {textarea ? <textarea rows={6} {...common} /> : <input type={type} inputMode={inputMode} {...common} />}
      {hint ? (
        <p id={`${id}-hint`} className="mt-1 text-meta text-ink-3">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} className="mt-1 flex items-center gap-1 text-small text-alert">
          <Icon name="alert" size={16} />
          {error}
        </p>
      ) : null}
    </div>
  );
}

/**
 * Contact form. Progressive: works as a plain HTML form; with JavaScript
 * it shows inline errors and a success message without leaving the page.
 */
export function ContactForm() {
  const [state, action, pending] = useActionState(submitContactForm, initial);
  const id = useId();
  const startedAtRef = useRef<HTMLInputElement>(null);
  const statusRef = useRef<HTMLDivElement>(null);

  // Stamp the form with the time it was shown (spam check on the server).
  useEffect(() => {
    if (startedAtRef.current) startedAtRef.current.value = String(Date.now());
  }, [state.status]);

  useEffect(() => {
    if (state.status !== "idle") statusRef.current?.focus();
  }, [state]);

  if (state.status === "success") {
    return (
      <div ref={statusRef} tabIndex={-1} role="status" className="rounded-md bg-gold-soft p-5">
        <p className="flex items-start gap-2 text-body text-ink">
          <Icon name="check" size={22} className="mt-0.5 shrink-0 text-gold-ink" />
          {state.message}
        </p>
      </div>
    );
  }

  const v = state.values;

  return (
    <form action={action} noValidate className="space-y-5">
      {state.status === "error" && state.message ? (
        <div ref={statusRef} tabIndex={-1} role="alert" className="rounded-md bg-alert-soft p-4 text-body text-alert">
          {state.message}
        </div>
      ) : null}

      <div className="grid gap-5 sm:grid-cols-2">
        <Field id={`${id}-name`} name="name" label="Ime in priimek" required autoComplete="name" error={state.errors?.name} defaultValue={v?.name} />
        <Field id={`${id}-email`} name="email" label="E-pošta" required type="email" inputMode="email" autoComplete="email" error={state.errors?.email} defaultValue={v?.email} />
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field id={`${id}-phone`} name="phone" label="Telefon" type="tel" inputMode="tel" autoComplete="tel" error={state.errors?.phone} defaultValue={v?.phone} />
        <Field id={`${id}-subject`} name="subject" label="Zadeva" defaultValue={v?.subject} />
      </div>
      <Field id={`${id}-message`} name="message" label="Sporočilo" required textarea error={state.errors?.message} defaultValue={v?.message} />

      {/* Honeypot — hidden from people, filled by bots. */}
      <div className="absolute -left-[9999px] top-auto h-px w-px overflow-hidden" aria-hidden="true">
        <label htmlFor={`${id}-website`}>Spletna stran</label>
        <input id={`${id}-website`} name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>
      <input ref={startedAtRef} type="hidden" name="t" defaultValue="0" />

      <div className="flex flex-wrap items-center gap-4">
        <button
          type="submit"
          disabled={pending}
          className={buttonClassName()}
        >
          {pending ? "Pošiljam …" : "Pošlji sporočilo"}
        </button>
        <p className="text-meta text-ink-3">Podatke uporabimo samo za odgovor na vaše sporočilo.</p>
      </div>
    </form>
  );
}
