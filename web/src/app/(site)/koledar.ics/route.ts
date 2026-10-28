/**
 * GET /koledar.ics — the parish calendar to subscribe to ("Naroči se na
 * koledar", webcal://…/koledar.ics): events from 30 days ago to 180 days
 * ahead and the Masses of the next 60 days, cancelled ones left out.
 */
import { getSettings } from "@/sanity/data";
import { feedIcs, icsHeaders } from "@/lib/calendar/feed";

export async function GET(): Promise<Response> {
  const settings = await getSettings();
  return new Response(await feedIcs(settings), { status: 200, headers: icsHeaders("zupnija-pirnice.ics") });
}
