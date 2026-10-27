/** Prijava: magic link by email, or Google. Invite only (see lib/auth.ts). */
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { adminOrigin, googleEnabled, loginErrorMessage } from "@/lib/auth";
import { getActor } from "@/lib/admin/session";
import { LoginForm } from "./LoginForm";
import s from "./login.module.css";

export const metadata: Metadata = { title: "Prijava — Urejanje", robots: { index: false, follow: false } };

type Props = { searchParams: Promise<{ error?: string | string[] }> };

export default async function LoginPage({ searchParams }: Props) {
  if (await getActor()) redirect("/");
  const { error } = await searchParams;
  const message = loginErrorMessage(Array.isArray(error) ? error[0] : error);
  const host = new URL(adminOrigin()).host;

  return (
    <div className={s.login}>
      <div className={s.art}>
        <div className={s.brand}>
          <span className={`${s.mark} ${s.markArt}`}>
            <CrossIcon />
          </span>
          <b>Župnija Pirniče</b>
        </div>
        <blockquote>Oznanila, maše in nameni na enem mestu.</blockquote>
        <small>{host}</small>
      </div>
      <div className={s.form}>
        <LoginForm error={message} google={googleEnabled} />
      </div>
    </div>
  );
}

function CrossIcon() {
  return (
    <svg className={s.i} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 2.5v19M6.5 8h11" />
    </svg>
  );
}
