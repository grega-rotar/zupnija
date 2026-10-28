import Link from "next/link";
import type { ARTICLES_QUERY_RESULT } from "@/sanity/types.generated";
import { dateOf, formatDate } from "@/lib/dates";
import { routes } from "@/lib/routes";
import { SanityImage, hasImage, ImagePlaceholder } from "@/components/sanity/SanityImage";
import { Icon } from "@/components/ui/Icon";
import { EmptyState, tile, tileHover } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

export type ArticleData = ARTICLES_QUERY_RESULT[number];

/** News tile (the homepage's "Iz življenja župnije"): photo, date, title, "Preberi". */
export function ArticleCard({ article, priority }: { article: ArticleData; priority?: boolean }) {
  return (
    <Link href={routes.article(article.slug)} className={cn(tile, tileHover, "group flex flex-col overflow-hidden no-underline")}>
      <div className="overflow-hidden bg-paper-2 shadow-[0_1px_0_rgb(31_28_24/0.06)]">
        {hasImage(article.image) ? (
          <SanityImage
            image={article.image}
            aspect={4 / 3}
            sizes="(min-width: 1024px) 24rem, (min-width: 640px) 50vw, 100vw"
            maxWidth={900}
            priority={priority}
            decorative
            imgClassName="saturate-[.7] transition-transform duration-[800ms] ease-out-soft group-hover:scale-[1.03] motion-reduce:transform-none"
          />
        ) : (
          <ImagePlaceholder className="aspect-[4/3]" />
        )}
      </div>
      <div className="flex flex-1 flex-col px-7 pb-7 pt-6">
        <time dateTime={article.publishedAt} className="text-[0.8125rem] font-semibold text-ink-3">
          {formatDate(dateOf(article.publishedAt))}
        </time>
        <h3 className="mt-2 text-[1.5rem] font-bold leading-[1.15] tracking-[-0.035em] text-ink">{article.title}</h3>
        {article.excerpt ? <p className="mt-2 line-clamp-3 text-small text-ink-2">{article.excerpt}</p> : null}
        <span className="mt-auto inline-flex items-center gap-1.5 pt-5 text-[0.9375rem] font-semibold text-gold-ink">
          Preberi <Icon name="arrow-right" size={14} className="transition-transform duration-200 group-hover:translate-x-[3px] motion-reduce:transform-none" />
        </span>
      </div>
    </Link>
  );
}

/** All news as a grid of tiles, three across on desktop (as on the homepage). */
export function ArticleList({ articles }: { articles: ArticleData[] }) {
  if (!articles.length) return <EmptyState title="Ni novic" text="Novice bodo objavljene, ko bo kaj novega." />;
  return (
    <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {articles.map((a, i) => (
        <li key={a._id} className="flex [&>a]:flex-1">
          <ArticleCard article={a} priority={i < 3} />
        </li>
      ))}
    </ul>
  );
}
