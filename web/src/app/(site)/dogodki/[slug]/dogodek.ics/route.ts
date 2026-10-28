/**
 * GET /dogodki/<slug>/dogodek.ics — one event as an iCalendar file
 * ("Dodaj v koledar → Apple / Outlook (.ics)"). Old Sanity slugs resolve as
 * on the event page; an unknown event is 404.
 */
import { getSettings } from "@/sanity/data";
import { getEvent } from "@/lib/data/events";
import { eventToCal, icsHeaders } from "@/lib/calendar/feed";
import { eventIcs } from "@/lib/calendar/ics";

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }): Promise<Response> {
  const { slug } = await params;
  const [settings, event] = await Promise.all([getSettings(), getEvent(slug)]);
  if (!event) return new Response("Not found", { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });
  return new Response(eventIcs(eventToCal(event, settings)), { status: 200, headers: icsHeaders(`${event.slug}.ics`) });
}
