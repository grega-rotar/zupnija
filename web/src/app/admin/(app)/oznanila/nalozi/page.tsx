import { asc } from "drizzle-orm";
import { db, schema } from "@/db";
import { UploadFlow } from "@/components/admin/oznanila/UploadFlow";
import { requirePageArea } from "@/lib/admin/next";
import { needsApproval } from "@/lib/admin/sections";
import { AI_BUSY_MESSAGE, getBulletin, nextMissingPeriod } from "@/lib/bulletin/service";
import { toFlow } from "../flow";

/** /oznanila/nalozi: pick → Claude reads → check → published; ?id=<bulletinId> resumes one. */
export default async function UploadPage({ searchParams }: { searchParams: Promise<{ id?: string }> }) {
  const actor = await requirePageArea("oznanila");
  const { id } = await searchParams;
  const [found, missing, churches] = await Promise.all([
    id && /^\d+$/.test(id) ? getBulletin(Number(id)) : null,
    nextMissingPeriod(),
    db.select({ slug: schema.churches.slug, name: schema.churches.shortName }).from(schema.churches).orderBy(asc(schema.churches.position)),
  ]);
  return (
    <UploadFlow
      key={found?.id ?? "new"}
      initial={found ? await toFlow(found) : null}
      target={{ start: missing.start, end: missing.end, title: missing.title }}
      churches={churches}
      approval={needsApproval(actor)}
      busyMessage={AI_BUSY_MESSAGE}
    />
  );
}
