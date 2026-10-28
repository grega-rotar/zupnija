import type { Metadata } from "next";
import Link from "next/link";
import { getSettings, search } from "@/sanity/data";
import { buildMetadata } from "@/lib/seo";
import { pathForDocument, routes } from "@/lib/routes";
import { formatDate } from "@/lib/dates";
import { SEARCH_TYPE_LABEL } from "@/lib/labels";
import { truncate } from "@/lib/utils";
import { Icon } from "@/components/ui/Icon";
import { Container, EmptyState, PageHeader, Section, Tag, buttonClassName } from "@/components/ui/primitives";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSettings();
  return buildMetadata({ settings, title: "Iskanje", path: routes.search, seo: { noIndex: true } });
}

type Props = { searchParams: Promise<{ q?: string }> };

export default async function SearchPage({ searchParams }: Props) {
  const { q = "" } = await searchParams;
  const term = q.trim().slice(0, 100);
  const results = term ? await search(term) : [];

  return (
    <>
      <PageHeader title="Kaj iščete?" accent="iščete" eyebrow={<p className="eyebrow">Iskanje</p>}>
        <form action={routes.search} method="get" role="search" className="mt-8 flex w-full max-w-xl gap-2 rounded-full bg-surface p-1.5 shadow-soft">
          <label htmlFor="q" className="sr-only">
            Kaj iščete?
          </label>
          <input
            id="q"
            name="q"
            type="search"
            defaultValue={term}
            placeholder="npr. birma, romanje, krst …"
            autoFocus={!term}
            className="min-h-11 min-w-0 flex-1 rounded-full bg-transparent px-4 text-body text-ink placeholder:text-ink-3 focus:outline-none focus-visible:outline-3 focus-visible:outline-gold focus-visible:outline-offset-2"
          />
          <button type="submit" className={buttonClassName()}>
            <Icon name="search" size={18} />
            Išči
          </button>
        </form>
      </PageHeader>
      <Section>
        <Container width="prose">
          {!term ? (
            <p className="text-center text-body text-ink-2">Iščete lahko po oznanilih, dogodkih, novicah, straneh in dokumentih.</p>
          ) : results.length ? (
            <>
              <p className="mb-4 px-2 text-small font-medium text-ink-3" role="status">
                {results.length} zadetkov za »{term}«
              </p>
              <ul className="divide-y divide-stone/70 rounded-lg bg-surface shadow-soft">
                {results.map((r) => {
                  const href = r._type === "parishDocument" ? (r.fileUrl ? `${r.fileUrl}?dl=` : routes.documents) : pathForDocument(r._type, r.slug);
                  if (!href) return null;
                  const external = href.startsWith("http");
                  const rawDate = typeof r.date === "string" ? r.date : null;
                  const date = rawDate ? formatDate(rawDate) : null;
                  return (
                    <li key={r._id} className="px-6 py-5 sm:px-8">
                      <div className="flex flex-wrap items-center gap-2 text-meta text-ink-3">
                        <Tag>{SEARCH_TYPE_LABEL[r._type] ?? r._type}</Tag>
                        {date ? <span>{date}</span> : null}
                      </div>
                      <h2 className="mt-2 text-[1.25rem] font-bold leading-snug tracking-[-0.03em] text-ink">
                        {external ? (
                          <a href={href} className="rounded-sm hover:text-gold-ink">
                            {r.title}
                          </a>
                        ) : (
                          <Link href={href} className="rounded-sm hover:text-gold-ink">
                            {r.title}
                          </Link>
                        )}
                      </h2>
                      {typeof r.summary === "string" && r.summary ? <p className="mt-1 text-small text-ink-2">{truncate(r.summary, 200)}</p> : null}
                    </li>
                  );
                })}
              </ul>
            </>
          ) : (
            <EmptyState title={`Ni zadetkov za »${term}«`} text="Poskusite z drugo besedo ali krajšim izrazom." />
          )}
        </Container>
      </Section>
    </>
  );
}
