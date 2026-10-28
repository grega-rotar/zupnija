import Link from "next/link";
import { getGiving } from "@/lib/giving/donations";
import { routes } from "@/lib/routes";
import { UpnQr } from "./UpnQr";

/** Footer: the small QR and the IBAN, linking to /daruj; nothing without an IBAN. */
export async function FooterGiving() {
  const giving = await getGiving();
  if (!giving) return null;
  return (
    <div className="flex items-center gap-4 border-b border-[rgb(14_14_16/0.07)] py-6">
      <Link
        href={routes.donate}
        aria-label="Darovi: UPN QR koda in podatki za nakazilo"
        className="block w-[5.5rem] shrink-0 rounded-[0.875rem] bg-surface p-1.5 shadow-[0_0_0_1px_rgb(14_14_16/0.07)]"
      >
        <UpnQr payload={giving.payload} />
      </Link>
      <div className="min-w-0">
        <h2 className="text-[13px] font-semibold tracking-[-0.005em] text-ink">Darovi za župnijo</h2>
        <p className="mt-1">
          TRR <span className="tnum whitespace-nowrap font-semibold text-ink">{giving.ibanGrouped}</span>
        </p>
        <p>
          <Link href={routes.donate} className="underline-offset-4 hover:text-ink hover:underline">
            Skenirajte kodo v bančni aplikaciji
          </Link>
        </p>
      </div>
    </div>
  );
}
