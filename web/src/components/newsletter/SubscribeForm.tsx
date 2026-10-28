"use client";

import { useActionState, useId } from "react";
import { subscribeAction } from "@/lib/newsletter/actions";
import { cn } from "@/lib/utils";
import s from "./newsletter.module.css";

/**
 * "Oznanila po e-pošti": one e-mail field in a white pill with "Prijavi me"
 * (tasks/proto-v4/partials/c.html .c-field). A server action through
 * lib/forms/public.ts; the answer replaces nothing, it shows under the field.
 */
export function SubscribeForm({ className, labelClassName }: { className?: string; labelClassName?: string }) {
  const [state, action, pending] = useActionState(subscribeAction, null);
  const id = useId();
  const error = state && !state.ok ? state.message : null;
  return (
    <form action={action} className={cn(s.form, className)} noValidate>
      <label htmlFor={`${id}-email`} className={cn(s.label, labelClassName)}>
        Vaš e-naslov
      </label>
      <div className={s.field} data-invalid={error ? "" : undefined}>
        <input
          id={`${id}-email`}
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          placeholder="vas@naslov.si"
          required
          defaultValue={state && !state.ok ? String(state.values?.email ?? "") : ""}
          aria-invalid={error ? true : undefined}
          aria-describedby={`${id}-msg`}
        />
        <button type="submit" className={s.btn} disabled={pending}>
          {pending ? "Pošiljam …" : "Prijavi me"}
        </button>
      </div>
      {/* The honeypot (lib/forms/public.ts): hidden from people, filled by bots. */}
      <div className={s.hp} aria-hidden="true">
        <label htmlFor={`${id}-website`}>Spletna stran</label>
        <input id={`${id}-website`} name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>
      <p id={`${id}-msg`} role={error ? "alert" : "status"} className={cn(s.msg, error ? s.err : state?.ok && s.ok)}>
        {state?.message ?? "Enkrat na mesec, ko izidejo. Odjava z enim klikom."}
      </p>
    </form>
  );
}
