import type { Giving } from "@/lib/giving/donations";
import { CopyButton } from "@/components/share/CopyButton";
import { cn } from "@/lib/utils";
import { UpnQr } from "./UpnQr";
import s from "./UpnSlip.module.css";

/**
 * The donation card as a filled-in UPN (ZUP-17): the printed order's fields
 * in its order, the QR where the printed UPN has it (top left, beside the
 * payer), the payee's side filled in and the payer's side and the amount
 * left empty. Every value is text (copyable, read by screen readers) and
 * comes from `giving.slip`, which is read back from the QR payload itself,
 * so the card and the code always say the same. On phones the fields stack
 * in one column under a large QR.
 */
export function UpnSlip({ giving, headingLevel = "h3", className }: { giving: Giving; headingLevel?: "h2" | "h3"; className?: string }) {
  const f = giving.slip;
  const H = headingLevel;
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
          <UpnQr payload={giving.payload} label={`UPN QR koda: ${f.purpose}, ${f.name}, ${f.iban}`} />
          <figcaption>UPN QR</figcaption>
        </figure>
        <dl className={s.fields}>
          <div className={cn(s.f, s.payer)}>
            <dt>Ime, ulica in kraj plačnika</dt>
            <dd className={s.empty}>
              <span className="sr-only">Izpolni plačnik.</span>
            </dd>
          </div>
          <div className={cn(s.f, s.amount)}>
            <dt>Znesek</dt>
            <dd className={s.empty}>
              <span className={s.cur} aria-hidden="true">
                EUR
              </span>
              <span className="sr-only">Izpolni plačnik.</span>
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
