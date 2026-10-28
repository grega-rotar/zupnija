"use client";

import { useState, type FormEvent } from "react";
import { buttonClassName } from "@/components/ui/primitives";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";

type Props = { error: string | null; google: boolean };

/* The editor's v4 field: small grey label, sunk input, gold ring on focus; the site's pill buttons. */
const inputClass =
  "block w-full min-h-12 rounded-sm bg-paper-2 px-4 py-3 text-body text-ink placeholder:text-ink-3 transition-colors " +
  "hover:bg-paper-3 focus:bg-surface focus:shadow-[0_0_0_2px_var(--color-gold)] focus:outline-none";
const stroke = "shrink-0 fill-none stroke-current [stroke-linecap:round] [stroke-linejoin:round] [stroke-width:1.75]";

export function LoginForm({ error, google }: Props) {
  const [email, setEmail] = useState("");
  const [stage, setStage] = useState<"form" | "sent">("form");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(error);

  async function send(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const address = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) {
      setMessage("Vpišite veljaven e-poštni naslov.");
      return;
    }
    setBusy(true);
    setMessage(null);
    const res = await authClient.signIn.magicLink({ email: address, callbackURL: "/", errorCallbackURL: "/prijava" });
    setBusy(false);
    if (res.error) {
      setMessage(res.error.status === 429 ? "Preveč poskusov. Počakajte minuto in poskusite znova." : "Pošiljanje ni uspelo. Poskusite znova.");
      return;
    }
    setStage("sent");
  }

  async function withGoogle() {
    setBusy(true);
    setMessage(null);
    const res = await authClient.signIn.social({ provider: "google", callbackURL: "/", errorCallbackURL: "/prijava" });
    if (res.error) {
      setBusy(false);
      setMessage("Prijava z Googlom ni uspela. Poskusite znova.");
    }
  }

  if (stage === "sent") {
    return (
      <div className="grid w-full max-w-md gap-5 rounded-lg bg-surface p-7 shadow-soft sm:p-10">
        <span className="flex size-14 items-center justify-center rounded-md bg-gradient-to-b from-[#b8913f] to-[#8a6a26] text-white">
          <MailIcon className="size-7" />
        </span>
        <h1 className="text-[2rem] leading-[1.05] tracking-[-0.045em]">Preverite e-pošto</h1>
        <p className="text-small text-ink-2">
          Na <b className="font-semibold text-ink">{email.trim()}</b> smo poslali povezavo za prijavo. Odprite jo na tej napravi. Velja 15 minut.
        </p>
        <p className="text-small text-ink-3">
          Ni sporočila? Poglejte med neželeno pošto ali{" "}
          <button type="button" className="underline underline-offset-4 hover:text-ink" onClick={() => setStage("form")}>
            vpišite drug naslov
          </button>
          .
        </p>
      </div>
    );
  }

  return (
    <form className="grid w-full max-w-md gap-5 rounded-lg bg-surface p-7 shadow-soft sm:p-10" onSubmit={send} noValidate>
      <div>
        <h1 className="text-[2rem] leading-[1.05] tracking-[-0.045em]">Prijava v urejanje</h1>
        <p className="mt-2 text-small text-ink-3">Vpišite e-pošto. Poslali vam bomo povezavo za prijavo, gesla ne potrebujete.</p>
      </div>
      {message ? (
        <p className="rounded-md bg-alert-soft px-4 py-3 text-small text-alert" role="alert">
          {message}
        </p>
      ) : null}
      <label className="grid gap-1.5">
        <span className="pl-0.5 text-meta font-semibold text-ink-3">E-pošta</span>
        <input
          className={inputClass}
          type="email"
          name="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="ime@primer.si"
          autoComplete="email"
          required
        />
      </label>
      <button className={cn(buttonClassName({ variant: "primary" }), "w-full")} type="submit" disabled={busy}>
        <MailIcon />
        Pošlji povezavo
      </button>
      {google ? (
        <>
          <div className="flex items-center gap-3 text-meta text-ink-3 before:h-px before:flex-1 before:bg-stone after:h-px after:flex-1 after:bg-stone">ali</div>
          <button type="button" className={cn(buttonClassName({ variant: "secondary" }), "w-full")} onClick={withGoogle} disabled={busy}>
            <GoogleIcon />
            Nadaljuj z Googlom
          </button>
        </>
      ) : null}
      <p className="text-meta text-ink-3">Dostop dodeli župnik. Če ga še nimate, ga prosite za povabilo.</p>
    </form>
  );
}

function MailIcon({ className }: { className?: string }) {
  return (
    <svg className={cn(stroke, className ?? "size-[1.125rem]")} viewBox="0 0 24 24" aria-hidden="true">
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="m22 7-10 6L2 7" />
    </svg>
  );
}

function GoogleIcon() {
  return (
    <svg className="size-[1.125rem] shrink-0" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.4h6.5a5.6 5.6 0 0 1-2.4 3.6v3h3.9c2.3-2.1 3.5-5.2 3.5-8.7z" />
      <path fill="#34A853" d="M12 24c3.2 0 6-1.1 8-2.9l-3.9-3c-1.1.7-2.5 1.2-4.1 1.2-3.1 0-5.8-2.1-6.7-5H1.3v3.1A12 12 0 0 0 12 24z" />
      <path fill="#FBBC05" d="M5.3 14.3a7.2 7.2 0 0 1 0-4.6V6.6h-4a12 12 0 0 0 0 10.8z" />
      <path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.3 6.6l4 3.1c.9-2.9 3.6-4.9 6.7-4.9z" />
    </svg>
  );
}
