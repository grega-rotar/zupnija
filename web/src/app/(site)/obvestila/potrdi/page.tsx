import type { Metadata } from "next";
import { Suspense } from "react";
import { NewsletterNotice } from "@/components/newsletter/Notice";
import { confirm } from "@/lib/newsletter/service";

export const metadata: Metadata = { title: "Potrditev prijave", robots: { index: false, follow: false } };

type Props = { searchParams: Promise<{ token?: string | string[] }> };

/** The link in the confirmation mail (ZUP-19): pending → active, once, within 48 hours. */
async function Confirm({ searchParams }: Props) {
  const { token } = await searchParams;
  const result = await confirm(Array.isArray(token) ? token[0] : token);
  if (result === "confirmed") return <NewsletterNotice title="Prijava je potrjena." lede="Oznanila boste prejemali enkrat mesečno." />;
  return <NewsletterNotice title="Povezava ni veljavna." lede="Morda je zastarela, že uporabljena ali ni cela. Prijavite se znova z obrazcem na dnu strani." />;
}

export default function ConfirmPage(props: Props) {
  return (
    <Suspense>
      <Confirm {...props} />
    </Suspense>
  );
}
