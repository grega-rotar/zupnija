import { buttonClassName } from "@/components/ui/primitives";
import { Icon } from "@/components/ui/Icon";
import { cn } from "@/lib/utils";

/** "Naroči se na koledar": the webcal:// address of /koledar.ics, which calendar apps subscribe to and refresh. */
export function SubscribeCalendar({ feedUrl, className }: { feedUrl: string; className?: string }) {
  const webcal = feedUrl.replace(/^https?:\/\//, "webcal://");
  return (
    <p className={cn("flex flex-wrap items-center justify-center gap-x-4 gap-y-2", className)}>
      <a href={webcal} title="Svete maše in dogodki v vašem koledarju, sproti posodobljeni" className={cn(buttonClassName({ variant: "secondary", size: "sm" }), "gap-2")}>
        <Icon name="calendar" size={16} />
        Naroči se na koledar
      </a>
    </p>
  );
}
