import { notFound, redirect } from "next/navigation";
import { requireActor } from "@/lib/admin/session";

/** Short address for Ljudje → Naročniki. Owner only; anyone else gets 404. */
export default async function SubscribersShortcut() {
  const actor = await requireActor();
  if (!actor.isOwner) notFound();
  redirect("/ljudje/narocniki");
}
