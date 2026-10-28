import type { Metadata } from "next";
import { Suspense } from "react";
import { NewsletterNotice } from "@/components/newsletter/Notice";

export const metadata: Metadata = { title: "Odjava od oznanil", robots: { index: false, follow: false } };

type Props = { searchParams: Promise<{ stanje?: string | string[] }> };

/** Where /obvestila/odjava (route.ts) sends the reader after unsubscribing; `?stanje=neveljavna` for an unknown link. */
async function Result({ searchParams }: Props) {
  const { stanje } = await searchParams;
  if (stanje === "neveljavna")
    return <NewsletterNotice title="Povezava ni" accent="veljavna." lede="Morda je zastarela ali ni cela. Če se želite odjaviti, nam pišite in vas bomo odjavili." />;
  return (
    <NewsletterNotice
      title="Odjavljeni"
      accent="ste."
      lede="Oznanil vam ne bomo več pošiljali. Če si premislite, se lahko kadar koli znova prijavite z obrazcem na dnu strani."
    />
  );
}

export default function UnsubscribedPage(props: Props) {
  return (
    <Suspense>
      <Result {...props} />
    </Suspense>
  );
}
