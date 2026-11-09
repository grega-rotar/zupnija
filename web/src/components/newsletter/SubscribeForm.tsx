"use client";

import Link from "next/link";
import { useActionState, useId } from "react";
import { subscribeAction } from "@/lib/newsletter/actions";
import { routes } from "@/lib/routes";
import { cn } from "@/lib/utils";
import s from "./newsletter.module.css";

/**
 * "Oznanila po e-pošti": one e-mail field in a white pill with "Prijavi me"
 * (tasks/proto-v4/partials/c.html .c-field). A server action through
 * lib/forms/public.ts. The wording is ZUP-19's, verbatim; the helper line
 * and the privacy link stay, the answer shows under them.
 */
export function SubscribeForm({ className, labelClassName }: { className?: string; labelClassName?: string }) {
  const [state, action, pending] = useActionState(subscribeAction, null);
  const id = useId();
  const error = state && !state.ok ? state.message : null;
  return (
    <form action={action} className={cn(s.form, className)} noValidate>
      <label htmlFor={`${id}-email`} className={cn(s.label, labelClassName)}>
        Elektronski naslov
      </label>
      <div className={s.field} data-invalid={error ? "" : undefined}>
        <input
          id={`${id}-email`}
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          placeholder="Vpišite svoj elektronski naslov"
          required
          defaultValue={state && !state.ok ? String(state.values?.email ?? "") : ""}
          aria-invalid={error ? true : undefined}
          aria-describedby={`${id}-help ${id}-msg`}
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
      <p id={`${id}-help`} className={s.msg}>
        Oznanila bodo na vaš elektronski naslov prišla enkrat mesečno, ob izidu. Od prejemanja se lahko kadarkoli odjavite. Več v{" "}
        <Link href={routes.privacy} className={s.link}>
          izjavi o zasebnosti
        </Link>
        .
      </p>
      <p id={`${id}-msg`} role={error ? "alert" : "status"} className={cn(s.msg, s.result, error ? s.err : state?.ok && s.ok)}>
        {state?.message ?? ""}
      </p>
    </form>
  );
}
