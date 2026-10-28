"use client";

import { useActionState, useId } from "react";
import { buttonClassName } from "@/components/ui/primitives";
import { intentionRequestAction } from "@/lib/forms/submit";
import type { FormResult } from "@/lib/forms/public";
import { errorOf, FormError, FormSuccess, Honeypot, SelectField, TextField, valueOf } from "./kit";

/** The Mass-intention request (US-007). `minDate` is today, for the date picker. */
export function IntentionRequestForm({ churches, minDate }: { churches: { slug: string; name: string }[]; minDate: string }) {
  const [state, action, pending] = useActionState<FormResult | null, FormData>(intentionRequestAction, null);
  const id = useId();
  if (state?.ok) return <FormSuccess message={state.message} />;
  const f = (name: string) => ({ id: `${id}-${name}`, name, error: errorOf(state, name), defaultValue: valueOf(state, name) });

  return (
    <form action={action} noValidate className="space-y-5">
      <FormError state={state} />
      <TextField {...f("text")} label="Za koga naj se daruje maša" required maxLength={200} placeholder="npr. + Franc Kralj, obletnica" hint="Največ 200 znakov." />
      <div className="grid gap-5 sm:grid-cols-2">
        <TextField {...f("date")} label="Želeni datum" type="date" min={minDate} />
        <SelectField {...f("church")} label="Cerkev" options={churches.map((c) => ({ value: c.slug, label: c.name }))} placeholder="Vseeno" />
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <TextField {...f("name")} label="Vaše ime in priimek" required autoComplete="name" />
        <TextField {...f("contact")} label="Telefon ali e-pošta" required autoComplete="tel" hint="Da vas lahko pokličemo ali vam pišemo." />
      </div>
      <TextField {...f("note")} label="Opomba" rows={3} />
      <Honeypot id={id} />
      <div className="flex flex-wrap items-center gap-4">
        <button type="submit" disabled={pending} className={buttonClassName()}>
          {pending ? "Pošiljam …" : "Pošlji prošnjo"}
        </button>
        <p className="text-meta text-ink-3">Podatke uporabimo samo za dogovor o namenu.</p>
      </div>
    </form>
  );
}
