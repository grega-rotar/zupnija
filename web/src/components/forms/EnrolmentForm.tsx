"use client";

import { useActionState, useId, useState } from "react";
import { buttonClassName } from "@/components/ui/primitives";
import { enrolAction } from "@/lib/forms/submit";
import type { FormResult } from "@/lib/forms/public";
import { CheckField, errorOf, Fieldset, FormError, FormSuccess, Honeypot, SelectField, TextField, valueOf, valuesOf } from "./kit";

export type EnrolmentGroup = { id: number; name: string };

const ACTIVITIES: [string, string][] = [
  ["ministranti", "Ministranti"],
  ["pevski_zbor", "Otroški pevski zbor"],
  ["skavti", "Skavti"],
];
const GRADES = Array.from({ length: 9 }, (_, i) => ({ value: String(i + 1), label: `${i + 1}. razred` }));

/**
 * The Verouk enrolment (US-006). After a successful submit, "Dodaj še enega
 * otroka" opens a fresh form with the parents' fields already filled in.
 */
export function EnrolmentForm({ groups, rulesHref }: { groups: EnrolmentGroup[]; rulesHref?: string | null }) {
  const [round, setRound] = useState(0);
  const [seed, setSeed] = useState<Record<string, string>>({});
  return (
    <Round
      key={round}
      groups={groups}
      rulesHref={rulesHref}
      seed={seed}
      onAnother={(values) => {
        setSeed(values);
        setRound((r) => r + 1);
      }}
    />
  );
}

function Round({
  groups,
  rulesHref,
  seed,
  onAnother,
}: {
  groups: EnrolmentGroup[];
  rulesHref?: string | null;
  seed: Record<string, string>;
  onAnother: (values: Record<string, string>) => void;
}) {
  const [state, action, pending] = useActionState<FormResult | null, FormData>(enrolAction, null);
  const id = useId();

  if (state?.ok) {
    return (
      <FormSuccess message={state.message}>
        <button type="button" className={buttonClassName({ variant: "secondary" })} onClick={() => onAnother(state.values ?? {})}>
          Dodaj še enega otroka z enakimi podatki staršev
        </button>
      </FormSuccess>
    );
  }

  const v = (name: string) => valueOf(state, name, seed[name] ?? "");
  const err = (name: string) => errorOf(state, name);
  const f = (name: string) => ({ id: `${id}-${name}`, name, error: err(name), defaultValue: v(name) });
  const acts = valuesOf(state, "activities");
  const closed = state && !state.ok && state.status === 409;

  return (
    <form action={action} noValidate className="space-y-8">
      <FormError state={state} />
      {closed ? null : (
        <>
          <Fieldset legend="Otrok">
            <div className="grid gap-5 sm:grid-cols-2">
              <TextField {...f("childFirstName")} label="Ime" required autoComplete="off" />
              <TextField {...f("childLastName")} label="Priimek" required autoComplete="off" />
              <TextField {...f("birthDate")} label="Datum rojstva" required type="date" />
              <TextField {...f("birthPlace")} label="Kraj rojstva" required />
              <TextField {...f("baptismDate")} label="Datum krsta" type="date" />
              <TextField {...f("baptismParish")} label="Župnija krsta" />
            </div>
            <TextField {...f("address")} label="Naslov" required autoComplete="street-address" hint="Ulica in hišna številka, pošta in kraj" />
          </Fieldset>

          <Fieldset legend="Razred in skupina">
            <div className="grid gap-5 sm:grid-cols-2">
              <SelectField {...f("grade")} label="Razred v šolskem letu" required options={GRADES} placeholder="Izberite razred" />
              {groups.length ? (
                <SelectField
                  {...f("groupId")}
                  label="Skupina verouka"
                  required
                  options={groups.map((g) => ({ value: String(g.id), label: g.name }))}
                  placeholder="Izberite skupino"
                />
              ) : null}
            </div>
            <div role="group" aria-labelledby={`${id}-acts`}>
              <p id={`${id}-acts`} className="mb-1.5 text-small font-medium text-ink">
                Otrok bi rad sodeloval tudi pri <span className="font-normal text-ink-3">(neobvezno)</span>
              </p>
              <div className="flex flex-wrap gap-x-6">
                {ACTIVITIES.map(([value, label]) => (
                  <CheckField key={value} id={`${id}-act-${value}`} name="activities" value={value} label={label} defaultChecked={acts.includes(value)} />
                ))}
              </div>
            </div>
          </Fieldset>

          <Fieldset legend="Starši" sub="Vpišite vsaj enega od staršev. Na vsak e-poštni naslov pošljemo potrdilo.">
            <div className="grid gap-5 sm:grid-cols-3">
              <TextField {...f("fatherName")} label="Oče" placeholder="Ime in priimek" autoComplete="off" />
              <TextField {...f("fatherEmail")} label="E-pošta" type="email" inputMode="email" autoComplete="off" />
              <TextField {...f("fatherPhone")} label="Mobilni telefon" type="tel" inputMode="tel" autoComplete="off" />
              <TextField {...f("motherName")} label="Mati" placeholder="Ime in priimek" autoComplete="off" />
              <TextField {...f("motherEmail")} label="E-pošta" type="email" inputMode="email" autoComplete="off" />
              <TextField {...f("motherPhone")} label="Mobilni telefon" type="tel" inputMode="tel" autoComplete="off" />
            </div>
          </Fieldset>

          <Fieldset legend="Soglasja">
            <CheckField id={`${id}-photoArchive`} name="photoArchive" label="Fotografije otroka pri verouku smemo hraniti v župnijskem arhivu." defaultChecked={v("photoArchive") === "on"} />
            <CheckField id={`${id}-photoPublish`} name="photoPublish" label="Fotografije otroka smemo objaviti na spletni strani in v oznanilih." defaultChecked={v("photoPublish") === "on"} />
            <CheckField
              id={`${id}-rules`}
              name="rules"
              error={err("rules")}
              defaultChecked={v("rules") === "on"}
              label={
                <>
                  Poznam in sprejemam{" "}
                  {rulesHref ? (
                    <a href={rulesHref} className="font-medium text-gold-ink underline underline-offset-2" target="_blank" rel="noopener noreferrer">
                      pravila veroučne šole
                    </a>
                  ) : (
                    "pravila veroučne šole"
                  )}
                  .
                </>
              }
            />
            <TextField {...f("notes")} label="Opomba" rows={3} hint="Npr. alergije ali kaj, kar naj katehist ve." />
          </Fieldset>
        </>
      )}

      <Honeypot id={id} />
      {closed ? null : (
        <div className="flex flex-wrap items-center gap-4">
          <button type="submit" disabled={pending} className={buttonClassName()}>
            {pending ? "Pošiljam …" : "Oddaj vpis"}
          </button>
          <p className="text-meta text-ink-3">Podatke uporabimo samo za verouk v naši župniji.</p>
        </div>
      )}
    </form>
  );
}
