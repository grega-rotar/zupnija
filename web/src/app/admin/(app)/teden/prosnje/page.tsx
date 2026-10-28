import { db, schema } from "@/db";
import { IntentionRequests, type RequestRow } from "@/components/admin/requests/IntentionRequests";
import { MaseTabs } from "@/components/admin/requests/Tabs";
import { PageHead } from "@/components/admin/ui";
import { requirePageArea } from "@/lib/admin/next";
import { can, needsApproval } from "@/lib/admin/sections";
import { formatDate } from "@/lib/dates";
import { getUpcomingMasses } from "@/lib/mase/queries";
import { intentionPrefill, listIntentionRequests } from "@/lib/mase/requests";

/** Maše in nameni → Prošnje (US-007): visitors' intention requests. */
export default async function ProsnjePage() {
  const actor = await requirePageArea("mase");
  const list = await listIntentionRequests();
  // Eight weeks of Masses, so a wished date a few weeks ahead is in the picker.
  const masses = list.length ? await getUpcomingMasses(400) : [];
  const churches = list.length ? await db.select({ id: schema.churches.id, slug: schema.churches.slug }).from(schema.churches) : [];

  const rows: RequestRow[] = list.map((r) => {
    const churchId = churches.find((c) => c.slug === r.churchSlug)?.id;
    const onDay = r.preferredDate ? masses.filter((m) => m.date === r.preferredDate && m.status !== "cancelled") : [];
    const mass = onDay.find((m) => m.churchId === churchId) ?? onDay[0];
    return {
      id: r.id,
      name: r.name,
      contact: r.contact,
      text: r.text,
      preferredDate: r.preferredDate,
      church: r.church,
      note: r.note,
      at: formatDate(r.createdAt.slice(0, 10)),
      pendingBy: r.pendingBy,
      prefill: { massId: mass?.id, ...intentionPrefill(r.text) },
    };
  });

  return (
    <div className="page enter">
      <PageHead title="Maše in nameni" sub="Prošnje za namen s spletne strani. Vpišite jih kot namen ali zavrnite." />
      <MaseTabs current="/teden/prosnje" requests={list.length} />
      <IntentionRequests rows={rows} masses={masses} viewer={{ id: actor.id, isOwner: actor.isOwner, approval: needsApproval(actor), canUpload: can(actor, "oznanila") }} />
    </div>
  );
}

