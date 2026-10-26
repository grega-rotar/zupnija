import Link from "next/link";
import type { ARTICLES_QUERY_RESULT } from "@/sanity/types.generated";
import { dateOf, formatDate } from "@/lib/dates";
import { routes } from "@/lib/routes";
import { SanityImage, hasImage, ImagePlaceholder } from "@/components/sanity/SanityImage";
import { EmptyState } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

export type ArticleData = ARTICLES_QUERY_RESULT[number];

export function ArticleCard({ article, priority }: { article: ArticleData; priority?: boolean }) {
  return (
    <article className="group">
      <Link href={routes.article(article.slug)} className="block no-underline">
        {hasImage(article.image) ? (
          <SanityImage image={article.image} aspect={4 / 3} sizes="(min-width: 1024px) 24rem, (min-width: 640px) 50vw, 100vw" maxWidth={900} priority={priority} decorative className="rounded-sm" imgClassName="transition-transform duration-700 ease-out-soft group-hover:scale-[1.02] motion-reduce:transform-none" />
        ) : (
          <ImagePlaceholder className="aspect-[4/3] rounded-sm" />
        )}
        <div className="mt-5 border-t border-stone pt-4">
          <p className="text-meta text-ink-3">
            <time dateTime={article.publishedAt}>{formatDate(dateOf(article.publishedAt))}</time>
          </p>
          <h3 className="mt-1 font-serif text-h3 text-ink group-hover:underline">{article.title}</h3>
          {article.excerpt ? <p className="mt-1.5 text-small text-ink-2">{article.excerpt}</p> : null}
        </div>
      </Link>
    </article>
  );
}

export function ArticleRow({ article }: { article: ArticleData }) {
  return (
    <li>
      <Link href={routes.article(article.slug)} className={cn("group grid gap-5 py-8 no-underline sm:gap-8", hasImage(article.image) && "sm:grid-cols-[18rem_1fr]")}>
        {hasImage(article.image) ? (
          <SanityImage image={article.image} aspect={4 / 3} sizes="(min-width: 640px) 18rem, 100vw" maxWidth={800} decorative className="rounded-sm" imgClassName="transition-transform duration-700 ease-out-soft group-hover:scale-[1.02] motion-reduce:transform-none" />
        ) : null}
        <div className="min-w-0">
          <p className="text-meta text-ink-3">
            <time dateTime={article.publishedAt}>{formatDate(dateOf(article.publishedAt))}</time>
          </p>
          <h3 className="mt-0.5 font-serif text-h3 text-ink group-hover:underline">{article.title}</h3>
          {article.excerpt ? <p className="mt-1.5 text-body text-ink-2">{article.excerpt}</p> : null}
        </div>
      </Link>
    </li>
  );
}

export function ArticleList({ articles }: { articles: ArticleData[] }) {
  if (!articles.length) return <EmptyState title="Ni novic" text="Novice bodo objavljene, ko bo kaj novega." />;
  return <ul className="divide-y divide-stone border-y border-stone">{articles.map((a) => <ArticleRow key={a._id} article={a} />)}</ul>;
}
