"use client";

import { useState, type FormEvent } from "react";
import { authClient } from "@/lib/auth-client";
import s from "./login.module.css";

type Props = { error: string | null; google: boolean };

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
      <div className={s.box}>
        <div className={s.sent}>
          <span className={s.seal}>
            <MailIcon />
          </span>
          <h1>Preverite e-pošto</h1>
          <p>
            Na <b>{email.trim()}</b> smo poslali povezavo za prijavo. Odprite jo na tej napravi. Velja 15 minut.
          </p>
          <p className={s.fine}>
            Ni sporočila? Poglejte med neželeno pošto ali{" "}
            <button type="button" onClick={() => setStage("form")}>
              vpišite drug naslov
            </button>
            .
          </p>
        </div>
      </div>
    );
  }

  return (
    <form className={s.box} onSubmit={send} noValidate>
      <div className={s.head}>
        <span className={s.mark}>
          <svg className={s.i} viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 2.5v19M6.5 8h11" />
          </svg>
        </span>
        <h1>Prijava v urejanje</h1>
      </div>
      <p className={s.lede}>Vpišite e-pošto. Poslali vam bomo povezavo za prijavo, gesla ne potrebujete.</p>
      {message ? (
        <p className={s.error} role="alert">
          {message}
        </p>
      ) : null}
      <label className={s.field}>
        <span>E-pošta</span>
        <input
          type="email"
          name="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="ime@primer.si"
          autoComplete="email"
          required
        />
      </label>
      <button className={`${s.btn} ${s.primary}`} type="submit" disabled={busy}>
        <MailIcon />
        Pošlji povezavo
      </button>
      {google ? (
        <>
          <div className={s.or}>ali</div>
          <button type="button" className={s.btn} onClick={withGoogle} disabled={busy}>
            <GoogleIcon />
            Nadaljuj z Googlom
          </button>
        </>
      ) : null}
      <p className={s.fine}>Dostop dodeli župnik. Če ga še nimate, ga prosite za povabilo.</p>
    </form>
  );
}

function MailIcon() {
  return (
    <svg className={s.i} viewBox="0 0 24 24" aria-hidden="true">
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="m22 7-10 6L2 7" />
    </svg>
  );
}

function GoogleIcon() {
  return (
    <svg className={s.g} viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.4h6.5a5.6 5.6 0 0 1-2.4 3.6v3h3.9c2.3-2.1 3.5-5.2 3.5-8.7z" />
      <path fill="#34A853" d="M12 24c3.2 0 6-1.1 8-2.9l-3.9-3c-1.1.7-2.5 1.2-4.1 1.2-3.1 0-5.8-2.1-6.7-5H1.3v3.1A12 12 0 0 0 12 24z" />
      <path fill="#FBBC05" d="M5.3 14.3a7.2 7.2 0 0 1 0-4.6V6.6h-4a12 12 0 0 0 0 10.8z" />
      <path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.3 6.6l4 3.1c.9-2.9 3.6-4.9 6.7-4.9z" />
    </svg>
  );
}
