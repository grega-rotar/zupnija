/**
 * "Izvozi CSV" on Verouk → Vpisi: every online enrolment, for the Verouk area
 * only (others get 404, as the tab). Never cached.
 */
import { can } from "@/lib/admin/sections";
import { getActor } from "@/lib/admin/session";
import { today } from "@/lib/clock";
import { enrolmentsCsv, listEnrolments } from "@/lib/verouk/enrolment";

export async function GET() {
  const actor = await getActor();
  if (!actor || !can(actor, "verouk")) return new Response("Not Found", { status: 404 });
  const csv = enrolmentsCsv(await listEnrolments());
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="vpisi-verouk-${today()}.csv"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
