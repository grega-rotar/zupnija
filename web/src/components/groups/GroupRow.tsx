import Link from "next/link";
import type { GROUPS_QUERY_RESULT } from "@/sanity/types.generated";
import { routes } from "@/lib/routes";
import { cn } from "@/lib/utils";
import { SanityImage, hasImage } from "@/components/sanity/SanityImage";

type Group = GROUPS_QUERY_RESULT[number];

/** Parish group as a list row: name, one line, when and where. */
export function GroupRow({ group }: { group: Group }) {
  const meta = [group.meetingSchedule, group.location].filter(Boolean).join(" · ");
  return (
    <li>
      <Link href={routes.group(group.slug)} className={cn("group grid h-full items-center gap-5 py-6 no-underline sm:gap-6", hasImage(group.image) && "grid-cols-[5rem_1fr] sm:grid-cols-[6rem_1fr]")}>
        {hasImage(group.image) ? (
          <SanityImage image={group.image} aspect={1} sizes="5.5rem" maxWidth={220} decorative className="rounded-md" />
        ) : null}
        <div className="min-w-0">
          <h3 className="font-serif text-h3 text-ink group-hover:underline">{group.title}</h3>
          {group.summary ? <p className="mt-0.5 text-small text-ink-2">{group.summary}</p> : null}
          {meta ? <p className="mt-1 text-meta text-ink-3">{meta}</p> : null}
        </div>
      </Link>
    </li>
  );
}
