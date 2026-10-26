import Link from "next/link";
import type { CHURCHES_QUERY_RESULT } from "@/sanity/types.generated";
import { CHURCH_KIND_LABEL } from "@/lib/labels";
import { clean } from "@/lib/clean";
import { routes } from "@/lib/routes";
import { SanityImage, hasImage } from "@/components/sanity/SanityImage";

type Church = Pick<CHURCHES_QUERY_RESULT[number], "_id" | "name" | "slug" | "kind" | "dedication" | "summary" | "image">;

/** Church card: photograph first, name, kind, one line of description. */
export function ChurchCard({ church, priority }: { church: Church; priority?: boolean }) {
  return (
    <article className="group">
      <Link href={routes.church(church.slug)} className="block no-underline">
        {hasImage(church.image) ? (
          <SanityImage image={church.image} aspect={4 / 3} sizes="(min-width: 1024px) 24rem, (min-width: 640px) 50vw, 100vw" maxWidth={900} priority={priority} decorative className="rounded-sm" imgClassName="transition-transform duration-700 ease-out-soft group-hover:scale-[1.02] motion-reduce:transform-none" />
        ) : (
          <div className="flex aspect-[4/3] items-center justify-center rounded-sm bg-paper-2 text-ink-3">
            <svg width="40" height="48" viewBox="0 0 22 26" aria-hidden="true">
              <path d="M11 2v22M3 9h16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </div>
        )}
        <div className="mt-5 border-t border-stone pt-4">
          <p className="text-meta text-ink-3">{CHURCH_KIND_LABEL[clean(church.kind)] ?? "Cerkev"}</p>
          <h3 className="mt-1 font-serif text-h3 text-ink group-hover:underline">{church.name}</h3>
          {church.summary ? <p className="mt-1.5 text-small text-ink-2">{church.summary}</p> : null}
        </div>
      </Link>
    </article>
  );
}
