import Link from "next/link";
import { getGiving } from "@/lib/giving/donations";
import { routes } from "@/lib/routes";
import { QrCard } from "./UpnQr";

/** The homepage "Podprite župnijo" tile: the parish's UPN QR and "Vse o darovih" (/daruj). */
export async function HomeGivingQr() {
  const giving = await getGiving();
  if (!giving) return null;
  return (
    <div className="ml-auto flex flex-col items-center gap-3">
      <QrCard payload={giving.payload} className="w-[11rem]" />
      <Link href={routes.donate} className="inline-flex min-h-11 items-center gap-1.5 text-[15px] font-semibold text-gold-ink underline-offset-4 hover:underline">
        Vse o darovih
        <span aria-hidden="true">→</span>
      </Link>
    </div>
  );
}
