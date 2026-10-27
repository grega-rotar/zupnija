import { asc } from "drizzle-orm";
import { db, schema } from "@/db";
import { UploadFlow } from "@/components/admin/oznanila/UploadFlow";
import { requirePageArea } from "@/lib/admin/next";
import { needsApproval } from "@/lib/admin/sections";
import { weekMasses } from "@/lib/bulletin/extract";
import { AI_BUSY_MESSAGE, getBulletin, nextWeekStart } from "@/lib/bulletin/service";
import { toFlow } from "../flow";

/** /oznanila/nalozi: pick → Claude reads → check → published; ?id=<bulletinId> resumes one. */
export default async function UploadPage({ searchParams }: { searchParams: Promise<{ id?: string }> }) {
  const actor = await requirePageArea("oznanila");
  const { id } = await searchParams;
  const found = id && /^\d+$/.test(id) ? await getBulletin(Number(id)) : null;
  const week = found?.weekStart ?? nextWeekStart();
  const [churches, masses] = await Promise.all([
    db.select({ slug: schema.churches.slug, name: schema.churches.shortName }).from(schema.churches).orderBy(asc(schema.churches.position)),
    weekMasses(db, week),
  ]);
  return (
    <UploadFlow
      key={found?.id ?? "new"}
      initial={found ? toFlow(found) : null}
      week={week}
      churches={churches}
      approval={needsApproval(actor)}
      busyMessage={AI_BUSY_MESSAGE}
      massCount={masses.length}
    />
  );
}
