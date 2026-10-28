"use client";

import { useActionState, useId, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { buttonClassName } from "@/components/ui/primitives";
import { telHref } from "@/lib/links";
import { sacramentRequestAction } from "@/lib/forms/submit";
import type { FormResult } from "@/lib/forms/public";
import { SACRAMENT_KIND_LABEL, SACRAMENT_KINDS, URGENT_KINDS, type SacramentKind } from "@/lib/sacraments/kinds";
import { errorOf, FormError, FormSuccess, Honeypot, SelectField, TextField, valueOf } from "./kit";

/** The sacrament enquiry (US-008). Sick calls and funerals show the emergency phone above the fields. */
export function SacramentForm({ kind, minDate, emergency }: { kind: SacramentKind; minDate: string; emergency: { label: string; phone: string } | null }) {
  const [state, action, pending] = useActionState<FormResult | null, FormData>(sacramentRequestAction, null);
  const [current, setCurrent] = useState<string>(kind);
  const id = useId();
  if (state?.ok) return <FormSuccess message={state.message} />;
  const f = (name: string, fallback = "") => ({ id: `${id}-${name}`, name, error: errorOf(state, name), defaultValue: valueOf(state, name, fallback) });
  const urgent = emergency && (URGENT_KINDS as string[]).includes(current);

  return (
    <form action={action} noValidate className="space-y-5">
      <FormError state={state} />
      <SelectField
        {...f("kind", kind)}
        label="Za kaj sprašujete"
        required
        options={SACRAMENT_KINDS.map((k) => ({ value: k, label: SACRAMENT_KIND_LABEL[k] }))}
        onChange={(e) => setCurrent(e.target.value)}
      />
      {urgent ? (
        <p className="flex items-start gap-2.5 rounded-md bg-gold-soft p-4 text-body text-ink" role="note">
          <Icon name="phone" size={20} className="mt-0.5 shrink-0 text-gold-ink" />
          <span>
            Za nujne primere pokličite:{" "}
            <a href={telHref(emergency.phone)} className="font-semibold text-gold-ink underline underline-offset-2">
              {emergency.phone}
            </a>
          </span>
        </p>
      ) : null}
      <div className="grid gap-5 sm:grid-cols-2">
        <TextField {...f("name")} label="Ime in priimek" required autoComplete="name" />
        <TextField {...f("contact")} label="Telefon ali e-pošta" required autoComplete="tel" />
      </div>
      <TextField {...f("date")} label="Želeni datum" type="date" min={minDate} className="sm:max-w-[calc(50%-0.625rem)]" />
      <TextField {...f("message")} label="Sporočilo" required rows={5} placeholder="Na kratko opišite, kaj želite." />
      <Honeypot id={id} />
      <div className="flex flex-wrap items-center gap-4">
        <button type="submit" disabled={pending} className={buttonClassName()}>
          {pending ? "Pošiljam …" : "Pošlji povpraševanje"}
        </button>
        <p className="text-meta text-ink-3">Podatke uporabimo samo za odgovor na vaše povpraševanje.</p>
      </div>
    </form>
  );
}
