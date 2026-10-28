import { notFound } from "next/navigation";
import { SubscribersScreen } from "@/components/newsletter/admin/SubscribersScreen";
import { requireActor } from "@/lib/admin/session";
import { newsletterStats } from "@/lib/newsletter/service";

/** Ljudje → Naročniki (PRD US-005). Owner only; anyone else gets 404. */
export default async function SubscribersPage() {
  const actor = await requireActor();
  if (!actor.isOwner) notFound();
  return <SubscribersScreen stats={await newsletterStats()} />;
}
