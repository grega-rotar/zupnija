import Link from "next/link";
import type { CURRENT_ANNOUNCEMENTS_QUERY_RESULT } from "@/sanity/types.generated";
import { dateOf, formatDayNumber, formatMonthShort, formatDate } from "@/lib/dates";
import { hrefFor, isExternalHref } from "@/lib/links";
import { routes } from "@/lib/routes";
import { clean } from "@/lib/clean";
import { cn } from "@/lib/utils";
import { EmptyState, Tag, TextLink } from "@/components/ui/primitives";

export type AnnouncementData = CURRENT_ANNOUNCEMENTS_QUERY_RESULT[number];

/**
 * Announcement as an editorial row: date column, serif title, summary,
 * optional action. Importance is a label, never colour alone.
 */
export function AnnouncementRow({ item, compact }: { item: AnnouncementData; compact?: boolean }) {
  const importance = clean(item.importance);
  const important = importance === "important";
  const urgent = importance === "urgent";
  const ctaHref = hrefFor(item.cta);
  const date = dateOf(item.publishFrom);
  return (
    <li className={cn("grid grid-cols-[4rem_1fr] gap-x-5 sm:grid-cols-[6rem_1fr] sm:gap-x-8", compact ? "py-5" : "py-7 sm:py-9")}>
      <div className="leading-none">
        <span className={cn("block font-serif text-ink", compact ? "text-[1.75rem]" : "text-[2.25rem] sm:text-[2.75rem]")}>{formatDayNumber(date)}</span>
        <span className="mt-1.5 block text-small text-ink-3">{formatMonthShort(date)}</span>
      </div>
      <div className="min-w-0 max-w-3xl">
        {urgent || important || item.publishUntil ? (
          <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-meta text-ink-3">
            {urgent ? <Tag tone="alert">Nujno</Tag> : important ? <Tag tone="gold">Pomembno</Tag> : null}
            {item.publishUntil ? <span>velja do {formatDate(dateOf(item.publishUntil))}</span> : null}
          </div>
        ) : null}
        <h3 className={cn("font-serif leading-tight text-ink", compact ? "text-h3" : "text-h2")}>
          <Link href={routes.announcement(item.slug)} className="hover:underline">
            {item.title}
          </Link>
        </h3>
        {item.summary ? <p className={cn("mt-2.5 max-w-prose text-ink-2", compact ? "text-small" : "text-lede")}>{item.summary}</p> : null}
        {ctaHref && item.cta?.label ? (
          <div className="mt-3">
            <TextLink href={ctaHref} external={isExternalHref(ctaHref)}>
              {item.cta.label}
            </TextLink>
          </div>
        ) : null}
      </div>
    </li>
  );
}

export function AnnouncementList({ items, compact, emptyText = "Trenutno ni aktualnih oznanil." }: { items: AnnouncementData[]; compact?: boolean; emptyText?: string }) {
  if (!items.length) return <EmptyState title="Ni oznanil" text={emptyText} />;
  return (
    <ul className="divide-y divide-stone border-y border-stone">
      {items.map((item) => (
        <AnnouncementRow key={item._id} item={item} compact={compact} />
      ))}
    </ul>
  );
}
