import { Home } from "@/components/admin/domov/Home";
import { requireActor } from "@/lib/admin/session";
import { loadHome } from "@/lib/domov/loader";

/** Domov ("Na vrsti"): what needs doing this week (US-004). */
export default async function HomePage() {
  const me = await requireActor();
  const v = await loadHome(me);
  return <Home v={v} isOwner={me.isOwner} />;
}
