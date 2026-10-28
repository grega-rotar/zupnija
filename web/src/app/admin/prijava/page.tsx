/** Prijava: magic link by email, or Google. Invite only (see lib/auth.ts). */
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ChurchMark } from "@/components/ui/ChurchMark";
import { adminOrigin, googleEnabled, loginErrorMessage } from "@/lib/auth";
import { getActor } from "@/lib/admin/session";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "Prijava — Urejanje", robots: { index: false, follow: false } };

type Props = { searchParams: Promise<{ error?: string | string[] }> };

/**
 * The site's language: its header (church mark, letter-spaced wordmark) and
 * its light PageHeader band (gold rule, display serif) beside the form.
 */
export default async function LoginPage({ searchParams }: Props) {
  if (await getActor()) redirect("/");
  const { error } = await searchParams;
  const message = loginErrorMessage(Array.isArray(error) ? error[0] : error);
  const host = new URL(adminOrigin()).host;

  return (
    <div className="grid h-dvh grid-rows-[auto_1fr] overflow-auto bg-paper text-ink md:grid-cols-2 md:grid-rows-1">
      <div className="flex flex-col justify-between gap-8 border-b border-stone bg-paper-2 px-4 py-6 sm:px-6 md:border-r md:border-b-0 md:p-12">
        <div className="flex items-center gap-3">
          <ChurchMark />
          <span className="font-sans text-[0.8125rem] font-semibold uppercase leading-[1.15] tracking-[0.16em] text-ink">
            Župnija
            <br />
            Pirniče
          </span>
        </div>
        <div>
          <span className="mb-7 block h-px w-12 bg-gold" aria-hidden="true" />
          <blockquote className="max-w-[16ch] font-serif text-h2 md:text-h1">Oznanila, maše in nameni na enem mestu.</blockquote>
        </div>
        <small className="text-small text-ink-3">{host}</small>
      </div>
      <div className="grid place-items-center px-4 py-8 sm:px-6">
        <LoginForm error={message} google={googleEnabled} />
      </div>
    </div>
  );
}
