import { HistoryList } from "@/components/admin/zgodovina/HistoryList";
import { PageHead } from "@/components/admin/ui";
import { requireActor } from "@/lib/admin/session";
import { listHistory } from "@/lib/zgodovina/queries";

/** Zgodovina: everyone may see it; helpers see their own sections and their own changes. */
export default async function HistoryPage() {
  const actor = await requireActor();
  const days = await listHistory(actor, { limit: 150 });
  return (
    <div className="page enter">
      <PageHead title="Zgodovina" sub="Vsaka sprememba, kdo jo je naredil in kdaj. Zadnjo lahko razveljavite." />
      <HistoryList days={days} />
    </div>
  );
}
