import { SitePreview } from "@/components/admin/mase/SitePreview";
import { WeekView, type WeekLink } from "@/components/admin/mase/WeekView";
import { requirePageArea } from "@/lib/admin/next";
import { can, needsApproval } from "@/lib/admin/sections";
import { today, weekStart } from "@/lib/clock";
import { addDays, formatWeekSpan, isIsoDate } from "@/lib/dates";
import { getMass, getUpcomingMasses, getWeek } from "@/lib/mase/queries";
import { countNewIntentionRequests } from "@/lib/mase/requests";
import { MaseTabs } from "@/components/admin/requests/Tabs";

/** How far ahead the week arrows go: Masses exist for the next 8 weeks (FR-7). */
const WEEKS_AHEAD = 8;

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/**
 * Maše in nameni. URL state: `?w=YYYY-MM-DD` (any day of the week; this week
 * when missing), `?pogled=strani`, `?masa=<id>`, `?nov=1`.
 */
export default async function TedenPage({ searchParams }: { searchParams: SearchParams }) {
  const actor = await requirePageArea("mase");
  const sp = await searchParams;
  const d = today();
  const first = weekStart(d);
  const last = weekStart(addDays(d, WEEKS_AHEAD * 7));

  const masaId = Number(one(sp.masa)) || null;
  const wParam = one(sp.w);
  let extra = null;
  let w = wParam && isIsoDate(wParam) ? weekStart(wParam) : null;
  // A link to one Mass without a week (e.g. from Domov) opens on its week.
  if (masaId && !w) {
    extra = await getMass(masaId);
    if (extra) w = weekStart(extra.date);
  }
  w = !w || w < first ? first : w > last ? last : w;

  const [week, upcoming, requests] = await Promise.all([getWeek(w), one(sp.nov) === "1" ? getUpcomingMasses() : null, countNewIntentionRequests()]);
  const inWeek = masaId != null && week.days.some((x) => x.masses.some((m) => m.id === masaId));
  if (masaId && !inWeek && !extra) extra = await getMass(masaId);

  const offset = Math.round((Date.parse(w) - Date.parse(first)) / (7 * 864e5));
  const link = (s: string): WeekLink => ({ w: s === first ? null : s });

  return (
    <WeekView
      viewer={{ id: actor.id, isOwner: actor.isOwner, approval: needsApproval(actor), canUpload: can(actor, "oznanila") }}
      today={d}
      week={week}
      span={formatWeekSpan(week.weekStart, week.weekEnd)}
      offset={offset}
      prev={w > first ? link(addDays(w, -7)) : null}
      next={w < last ? link(addDays(w, 7)) : null}
      extraMass={inWeek ? null : extra}
      upcoming={upcoming}
      sitePreview={<SitePreview date={w} />}
      tabs={<MaseTabs current="/teden" requests={requests} />}
    />
  );
}
