import type { Metadata } from "next";
import { Suspense } from "react";
import { NewsletterNotice } from "@/components/newsletter/Notice";
import { confirm } from "@/lib/newsletter/service";

export const metadata: Metadata = { title: "Potrditev prijave", robots: { index: false, follow: false } };

type Props = { searchParams: Promise<{ token?: string | string[] }> };

/** The link in the confirmation mail (PRD US-005): pending → active. */
async function Confirm({ searchParams }: Props) {
  const { token } = await searchParams;
  const result = await confirm(Array.isArray(token) ? token[0] : token);
  if (result === "confirmed")
    return <NewsletterNotice title="Prijava je" accent="potrjena." lede="Hvala. Oznanila vam bomo poslali po e-pošti, ko izidejo. Enkrat na mesec, nič drugega." />;
  if (result === "already") return <NewsletterNotice title="Prijava je že" accent="potrjena." lede="Oznanila vam bomo poslali po e-pošti, ko izidejo." />;
  return <NewsletterNotice title="Povezava ni" accent="veljavna." lede="Morda je zastarela ali ni cela. Prijavite se znova z obrazcem na dnu strani." />;
}

export default function ConfirmPage(props: Props) {
  return (
    <Suspense>
      <Confirm {...props} />
    </Suspense>
  );
}
