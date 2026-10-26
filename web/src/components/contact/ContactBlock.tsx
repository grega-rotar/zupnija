import type { SETTINGS_QUERY_RESULT } from "@/sanity/types.generated";
import { WEEKDAY_LABEL, formatTime, type Weekday } from "@/lib/dates";
import { telHref } from "@/lib/links";
import { personRole } from "@/lib/labels";
import { cn } from "@/lib/utils";
import { RichText } from "@/components/sanity/RichText";
import { SanityImage, hasImage } from "@/components/sanity/SanityImage";
import { MetaRow } from "@/components/ui/primitives";

type Props = {
  settings: SETTINGS_QUERY_RESULT | null;
  /** Temporary note from an active special period, e.g. "Med prazniki uradnih ur ni." */
  officeHoursOverride?: string | null;
  className?: string;
  /** Show the pastor's card. */
  showPastor?: boolean;
};

/** Contact details and office hours straight from parish settings. */
export function ContactBlock({ settings, officeHoursOverride, className, showPastor = true }: Props) {
  if (!settings) return null;
  const address = settings.address;
  const addressLine = [address?.street, [address?.postalCode, address?.city].filter(Boolean).join(" ")].filter(Boolean).join(", ");
  const mapsHref = addressLine ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addressLine)}` : null;
  const pastor = settings.pastor;

  return (
    <div className={cn("grid gap-5 md:grid-cols-2", className)}>
      <div className="rounded-md border border-stone bg-paper p-5 sm:p-7">
        <h3 className="text-h3">Župnišče</h3>
        <div className="mt-4 space-y-3">
          {addressLine ? (
            <MetaRow icon="pin">
              {mapsHref ? (
                <a href={mapsHref} target="_blank" rel="noopener noreferrer" className="hover:underline">
                  {addressLine}
                </a>
              ) : (
                addressLine
              )}
            </MetaRow>
          ) : null}
          {settings.phone ? (
            <MetaRow icon="phone">
              <a href={telHref(settings.phone)} className="hover:underline">
                {settings.phone}
              </a>
              {settings.mobile ? (
                <>
                  {" · "}
                  <a href={telHref(settings.mobile)} className="hover:underline">
                    {settings.mobile}
                  </a>
                </>
              ) : null}
            </MetaRow>
          ) : settings.mobile ? (
            <MetaRow icon="phone">
              <a href={telHref(settings.mobile)} className="hover:underline">
                {settings.mobile}
              </a>
            </MetaRow>
          ) : null}
          {settings.email ? (
            <MetaRow icon="mail">
              <a href={`mailto:${settings.email}`} className="hover:underline">
                {settings.email}
              </a>
            </MetaRow>
          ) : null}
        </div>

        {settings.emergencyContact?.phone ? (
          <div className="mt-6 rounded-md bg-paper-2 p-4">
            <p className="text-small font-medium text-ink">{settings.emergencyContact.label || "Nujni primeri"}</p>
            <a href={telHref(settings.emergencyContact.phone)} className="mt-1 inline-block font-serif text-h3 text-ink hover:underline">
              {settings.emergencyContact.phone}
            </a>
          </div>
        ) : null}

        {showPastor && pastor ? (
          <div className="mt-8 flex items-center gap-4">
            {hasImage(pastor.photo) ? (
              <SanityImage image={pastor.photo} aspect={1} sizes="4rem" maxWidth={160} className="size-16 shrink-0 rounded-full" />
            ) : null}
            <div>
              <p className="font-medium text-ink">{pastor.name}</p>
              <p className="text-small text-ink-2">{personRole(pastor)}</p>
              {pastor.showContact !== false && (pastor.phone || pastor.email) ? (
                <p className="mt-0.5 text-small text-ink-2">
                  {pastor.phone ? (
                    <a href={telHref(pastor.phone)} className="hover:underline">
                      {pastor.phone}
                    </a>
                  ) : null}
                  {pastor.phone && pastor.email ? " · " : null}
                  {pastor.email ? (
                    <a href={`mailto:${pastor.email}`} className="hover:underline">
                      {pastor.email}
                    </a>
                  ) : null}
                </p>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>

      <div className="rounded-md border border-stone bg-paper p-5 sm:p-7">
        <h3 className="text-h3">Uradne ure</h3>
        {officeHoursOverride ? (
          <p className="mt-4 rounded-md border-l-2 border-gold bg-gold-soft/60 px-4 py-3 text-body text-ink">{officeHoursOverride}</p>
        ) : null}
        {settings.officeHours?.length ? (
          <dl className={cn("divide-y divide-stone", officeHoursOverride ? "mt-4" : "mt-4")}>
            {settings.officeHours.map((h) => (
              <div key={h._key} className="grid grid-cols-[7rem_1fr] gap-4 py-2.5">
                <dt className="capitalize text-ink-2">{WEEKDAY_LABEL[h.weekday as Weekday] ?? h.weekday}</dt>
                <dd>
                  <span className="tnum font-medium text-ink">
                    {formatTime(h.from)}–{formatTime(h.to)}
                  </span>
                  {h.note ? <span className="block text-small text-ink-3">{h.note}</span> : null}
                </dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="mt-4 text-small text-ink-3">Uradne ure po dogovoru.</p>
        )}
        {settings.officeHoursNote?.length ? <RichText value={settings.officeHoursNote} size="sm" className="mt-4 text-ink-2" /> : null}
      </div>
    </div>
  );
}
