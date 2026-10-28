import { Home } from "@/components/admin/domov/Home";
import { SacramentInbox } from "@/components/admin/requests/SacramentInbox";
import { can } from "@/lib/admin/sections";
import { requireActor } from "@/lib/admin/session";
import { formatDate } from "@/lib/dates";
import { loadHome } from "@/lib/domov/loader";
import { kindLabel } from "@/lib/sacraments/kinds";
import { listOpenSacramentRequests } from "@/lib/sacraments/requests";

/** Domov ("Na vrsti"): what needs doing this week (US-004), plus sacrament enquiries (US-008). */
export default async function HomePage() {
  const me = await requireActor();
  const [v, enquiries] = await Promise.all([loadHome(me), can(me, "zupnija") ? listOpenSacramentRequests() : []]);
  const inbox = enquiries.length ? (
    <SacramentInbox
      key="enquiries"
      rows={enquiries.map((r) => ({
        id: r.id,
        title: `${kindLabel(r.kind)} · ${r.name}`,
        contact: r.contact,
        when: [`poslano ${formatDate(r.createdAt.slice(0, 10))}`, r.preferredDate ? `želi ${formatDate(r.preferredDate)}` : null].filter(Boolean).join(" · "),
        message: r.message,
      }))}
    />
  ) : null;
  return <Home v={v} isOwner={me.isOwner} inbox={inbox} />;
}
