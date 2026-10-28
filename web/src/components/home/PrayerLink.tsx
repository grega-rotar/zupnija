import Link from "next/link";
import { hasPrayerPage } from "@/lib/prayer/page";
import { routes } from "@/lib/routes";

/** The footer's "Molitev in češčenje" item; nothing while /molitev has no items (US-012). */
export async function PrayerFooterLink({ className }: { className?: string }) {
  if (!(await hasPrayerPage())) return null;
  return (
    <li>
      <Link href={routes.prayer} className={className}>
        Molitev in češčenje
      </Link>
    </li>
  );
}
