import Link from "next/link";
import type { GROUPS_QUERY_RESULT } from "@/sanity/types.generated";
import { routes } from "@/lib/routes";
import { cn } from "@/lib/utils";
import { SanityImage, hasImage } from "@/components/sanity/SanityImage";
import { Icon } from "@/components/ui/Icon";
import { tile, tileHover } from "@/components/ui/primitives";

type Group = GROUPS_QUERY_RESULT[number];

/** Parish group as a tile: photo, name, one line, when and where. */
export function GroupRow({ group }: { group: Group }) {
  const meta = [group.meetingSchedule, group.location].filter(Boolean).join(" · ");
  return (
    <li className="flex">
      <Link
        href={routes.group(group.slug)}
        className={cn(tile, tileHover, "group grid flex-1 items-center gap-5 p-5 no-underline sm:p-6", hasImage(group.image) ? "grid-cols-[5rem_1fr_auto]" : "grid-cols-[1fr_auto]")}
      >
        {hasImage(group.image) ? (
          <SanityImage image={group.image} aspect={1} sizes="5rem" maxWidth={220} decorative className="overflow-hidden rounded-md" imgClassName="saturate-[.7]" />
        ) : null}
        <div className="min-w-0">
          <h3 className="text-[1.25rem] font-bold leading-snug tracking-[-0.03em] text-ink">{group.title}</h3>
          {group.summary ? <p className="mt-1 text-small text-ink-2">{group.summary}</p> : null}
          {meta ? <p className="mt-1.5 text-meta font-medium text-ink-3">{meta}</p> : null}
        </div>
        <Icon name="arrow-right" size={16} className="text-gold-ink transition-transform duration-200 group-hover:translate-x-[3px] motion-reduce:transform-none" />
      </Link>
    </li>
  );
}
