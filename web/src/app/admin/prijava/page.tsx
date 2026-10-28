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
 * The editor's v4 language: the sidebar's translucent ground with the parish's
 * name and one headline (Inter 700, one serif italic phrase) beside the form
 * on a white tile.
 */
export default async function LoginPage({ searchParams }: Props) {
  if (await getActor()) redirect("/");
  const { error } = await searchParams;
  const message = loginErrorMessage(Array.isArray(error) ? error[0] : error);
  const host = new URL(adminOrigin()).host;

  return (
    <div className="grid h-dvh grid-rows-[auto_1fr] overflow-auto bg-[#f5f4f1] text-ink md:grid-cols-2 md:grid-rows-1">
      <div className="flex flex-col justify-between gap-6 border-b border-[rgb(20_12_4/0.07)] bg-[rgb(236_233_227/0.85)] px-4 py-5 sm:px-6 md:border-r md:border-b-0 md:p-12">
        <div className="flex items-center gap-2.5">
          <ChurchMark className="w-7" />
          <span className="text-[0.9375rem] font-bold leading-tight tracking-[-0.02em] text-ink">Župnija Pirniče</span>
        </div>
        <div>
          <blockquote className="max-w-[14ch] text-h2 font-bold md:text-h1">
            Oznanila, maše in nameni <span className="accent">na enem mestu.</span>
          </blockquote>
        </div>
        <small className="text-meta text-ink-3">{host}</small>
      </div>
      <div className="grid place-items-center px-4 py-8 sm:px-6">
        <LoginForm error={message} google={googleEnabled} />
      </div>
    </div>
  );
}
