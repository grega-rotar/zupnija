import Link from "next/link";
import type { GROUPS_QUERY_RESULT } from "@/sanity/types.generated";
import { routes } from "@/lib/routes";
import { cn } from "@/lib/utils";
import { SanityImage, hasImage } from "@/components/sanity/SanityImage";
import { tile, tileHover } from "@/components/ui/primitives";
import { GroupIcon } from "./GroupIcon";

type Group = GROUPS_QUERY_RESULT[number];

/** Where a group's card leads: its own page, or the page it names (Verouk → /verouk). */
export const groupHref = (g: Pick<Group, "href" | "slug">) => g.href || routes.group(g.slug);

/** A group as a card (ZUP-13): its icon, or the photo set for the card, and the name. The whole card is the link. */
export function GroupCard({ group }: { group: Group }) {
  return (
    <li className="flex">
      <Link
        href={groupHref(group)}
        className={cn(
          tile,
          tileHover,
          "flex flex-1 flex-col items-center gap-4 px-3 pb-6 pt-7 text-center no-underline outline-offset-4 sm:gap-5 sm:px-5 sm:pb-7 sm:pt-8",
        )}
      >
        {hasImage(group.cardImage) ? (
          <SanityImage image={group.cardImage} aspect={1} sizes="72px" maxWidth={216} decorative className="size-[72px] shrink-0 rounded-[22%]" imgClassName="saturate-[.7]" />
        ) : (
          <GroupIcon icon={group.icon} />
        )}
        <h2 className="text-balance text-[0.9375rem] font-semibold leading-snug tracking-[-0.015em] text-ink sm:text-[1.0625rem]">{group.title}</h2>
      </Link>
    </li>
  );
}
