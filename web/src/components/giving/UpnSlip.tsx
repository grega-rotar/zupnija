"use client";

import { useId, useMemo, useState } from "react";
import type { Giving } from "@/lib/giving/donations";
import { buildUpnQr } from "@/lib/giving/upnqr";
import { CopyButton } from "@/components/share/CopyButton";
import { cn } from "@/lib/utils";
import { UpnQr } from "./UpnQr";
import s from "./UpnSlip.module.css";

/** "25", "25,50", "1.000,00" → euros; anything else (or nothing) → null. */
export function parseAmount(raw: string): number | null {
  let v = raw.replace(/\s|€|eur/gi, "");
  if (!v) return null;
  if (v.includes(",")) v = v.replace(/\./g, "").replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(v)) return null;
  const n = Number(v);
  return n > 0 && n < 1_000_000_000 ? n : null;
}

/**
 * The donation card as a filled-in UPN (ZUP-17): the printed order's fields
 * in its order, the QR where the printed UPN has it (top left, beside the
 * payer). The payee's side comes from `giving.slip` (read back from the QR
 * payload); the payer's name, address and the amount are inputs, and the QR
 * is rebuilt as they type, so a banking app reads everything filled in.
 * Nothing typed here leaves the browser. On phones the fields stack in one
 * column under a large QR.
 */
export function UpnSlip({ giving, headingLevel = "h3", className }: { giving: Giving; headingLevel?: "h2" | "h3"; className?: string }) {
  const f = giving.slip;
  const H = headingLevel;
  const id = useId();
  const [name, setName] = useState("");
  const [street, setStreet] = useState("");
  const [city, setCity] = useState("");
  const [amountRaw, setAmountRaw] = useState("");
  const amount = parseAmount(amountRaw);
  const amountInvalid = amountRaw.trim() !== "" && amount === null;

  const payload = useMemo(() => {
    if (!name.trim() && !street.trim() && !city.trim() && amount === null) return giving.payload;
    try {
      return buildUpnQr({
        iban: giving.iban,
        name: f.name,
        address: f.street,
        city: f.city,
        purpose: f.purpose,
        code: f.code,
        reference: f.reference,
        amount,
        payer: { name, street, city },
      });
    } catch {
      return giving.payload;
    }
  }, [giving.payload, giving.iban, f, name, street, city, amount]);

  return (
    <div className={cn(s.slip, className)}>
      <div className={s.bar}>
        <H className={s.title}>Dar z nakazilom</H>
        <p className={s.mark} aria-label="Univerzalni plačilni nalog">
          <b aria-hidden="true">UPN</b>
          <span aria-hidden="true">Univerzalni plačilni nalog</span>
        </p>
      </div>
      <div className={s.form}>
        <figure className={s.qr}>
          <UpnQr payload={payload} label={`UPN QR koda: ${f.purpose}, ${f.name}, ${f.iban}${amount !== null ? `, ${amountRaw.trim()} EUR` : ""}`} />
          <figcaption>UPN QR</figcaption>
        </figure>
        <dl className={s.fields}>
          <div className={cn(s.f, s.payer)}>
            <dt id={`${id}-payer`}>Ime, ulica in kraj plačnika</dt>
            <dd className={s.inputs} role="group" aria-labelledby={`${id}-payer`}>
              <input className={s.input} value={name} onChange={(e) => setName(e.target.value)} maxLength={33} autoComplete="name" placeholder="Ime in priimek" aria-label="Ime in priimek plačnika" />
              <input className={s.input} value={street} onChange={(e) => setStreet(e.target.value)} maxLength={33} autoComplete="street-address" placeholder="Ulica in hišna številka" aria-label="Ulica plačnika" />
              <input className={s.input} value={city} onChange={(e) => setCity(e.target.value)} maxLength={33} autoComplete="address-level2" placeholder="Pošta in kraj" aria-label="Pošta in kraj plačnika" />
            </dd>
          </div>
          <div className={cn(s.f, s.amount)}>
            <dt>
              <label htmlFor={`${id}-amount`}>Znesek</label>
            </dt>
            <dd className={s.inputs}>
              <span className={s.amountRow}>
                <input
                  id={`${id}-amount`}
                  className={cn(s.input, s.mono)}
                  value={amountRaw}
                  onChange={(e) => setAmountRaw(e.target.value)}
                  inputMode="decimal"
                  autoComplete="off"
                  placeholder="0,00"
                  aria-invalid={amountInvalid || undefined}
                  aria-describedby={amountInvalid ? `${id}-amount-err` : undefined}
                />
                <span className={s.cur} aria-hidden="true">
                  EUR
                </span>
              </span>
              {amountInvalid ? (
                <span id={`${id}-amount-err`} className={s.err}>
                  Npr. 20 ali 20,50
                </span>
              ) : null}
            </dd>
          </div>
          <div className={cn(s.f, s.code)}>
            <dt>Koda namena</dt>
            <dd>{f.code}</dd>
          </div>
          <div className={cn(s.f, s.purpose)}>
            <dt>Namen plačila</dt>
            <dd>{f.purpose}</dd>
          </div>
          <div className={cn(s.f, s.iban)}>
            <dt>IBAN prejemnika</dt>
            <dd>
              <span className={s.mono}>{f.iban}</span>
              <CopyButton text={giving.iban} label="Kopiraj" done="IBAN je kopiran." className={s.copy} />
            </dd>
          </div>
          <div className={cn(s.f, s.ref)}>
            <dt>Referenca prejemnika</dt>
            <dd className={s.mono}>{f.reference}</dd>
          </div>
          <div className={cn(s.f, s.name)}>
            <dt>Ime, ulica in kraj prejemnika</dt>
            <dd>
              {[f.name, f.street, f.city].filter(Boolean).map((line) => (
                <span key={line} className={s.line}>
                  {line}
                </span>
              ))}
            </dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
