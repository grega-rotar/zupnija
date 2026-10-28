import { googleCalendarUrl, type CalEvent } from "@/lib/calendar/ics";
import { buttonClassName } from "@/components/ui/primitives";
import { Icon } from "@/components/ui/Icon";
import { cn } from "@/lib/utils";

/**
 * "Dodaj v koledar" (US-010): Google koledar (times in Ljubljana via `ctz`)
 * and the event's .ics file for Apple and Outlook. Plain links, no script.
 */
export function AddToCalendar({ event, icsHref, className }: { event: CalEvent; icsHref: string; className?: string }) {
  const pill = cn(buttonClassName({ variant: "secondary", size: "sm" }), "gap-2");
  return (
    <div className={className}>
      <p className="text-small font-semibold text-ink-3" id="koledar-h">
        Dodaj v koledar
      </p>
      <ul className="mt-2 flex flex-wrap gap-2" aria-labelledby="koledar-h">
        <li>
          <a href={googleCalendarUrl(event)} target="_blank" rel="noopener noreferrer" className={pill}>
            <Icon name="calendar" size={16} />
            Google koledar
          </a>
        </li>
        <li>
          <a href={icsHref} download className={pill}>
            <Icon name="download" size={16} />
            Apple / Outlook (.ics)
          </a>
        </li>
      </ul>
    </div>
  );
}
