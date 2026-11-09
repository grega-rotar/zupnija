"use client";

import Link from "next/link";
import { useActionState, useId } from "react";
import { buttonClassName } from "@/components/ui/primitives";
import { prayerRequestAction } from "@/lib/groups/actions";
import type { FormResult } from "@/lib/forms/public";
import { CheckField, errorOf, FormError, FormSuccess, Honeypot, TextField, valueOf } from "@/components/forms/kit";

/** The anonymous prayer request (ZUP-25): one text, the consent, nothing about the sender. */
export function PrayerRequestForm({ group }: { group: string }) {
  const [state, action, pending] = useActionState<FormResult | null, FormData>(prayerRequestAction, null);
  const id = useId();
  if (state?.ok) return <FormSuccess message={state.message} />;

  return (
    <form action={action} noValidate className="relative space-y-5">
      <FormError state={state} />
      <input type="hidden" name="group" value={group} />
      <TextField
        id={`${id}-text`}
        name="text"
        label="Vaša prošnja"
        required
        rows={6}
        maxLength={1000}
        defaultValue={valueOf(state, "text")}
        error={errorOf(state, "text")}
        hint="Prošnja je anonimna. Prejme jo župnik in ne bo objavljena."
      />
      <CheckField
        id={`${id}-consent`}
        name="consent"
        error={errorOf(state, "consent")}
        defaultChecked={valueOf(state, "consent") === "on"}
        label={
          <>
            Soglašam, da prošnjo prejme župnik.{" "}
            <Link href="/zasebnost" className="font-medium text-gold-ink underline decoration-gold/40 underline-offset-2 hover:text-moss-deep">
              Izjava o zasebnosti
            </Link>
          </>
        }
      />
      <Honeypot id={id} />
      <button type="submit" disabled={pending} className={buttonClassName()}>
        {pending ? "Pošiljam …" : "Pošlji prošnjo"}
      </button>
    </form>
  );
}
