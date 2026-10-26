import type { Metadata } from "next";
import Link from "next/link";
import { getSettings, search } from "@/sanity/data";
import { buildMetadata } from "@/lib/seo";
import { pathForDocument, routes } from "@/lib/routes";
import { formatDate } from "@/lib/dates";
import { SEARCH_TYPE_LABEL } from "@/lib/labels";
import { truncate } from "@/lib/utils";
import { Icon } from "@/components/ui/Icon";
import { Container, EmptyState, PageHeader, Section, Tag } from "@/components/ui/primitives";

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
      <PageHeader title="Iskanje">
        <form action={routes.search} method="get" role="search" className="mt-6 flex max-w-xl gap-2">
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
            className="min-h-12 flex-1 rounded-sm border border-stone-2 bg-paper px-4 text-body text-ink placeholder:text-ink-3 focus:border-ink focus:outline-none focus-visible:outline-3 focus-visible:outline-gold focus-visible:outline-offset-2"
          />
          <button type="submit" className="inline-flex min-h-12 items-center gap-2 rounded-sm bg-ink px-5 font-medium text-paper hover:bg-moss">
            <Icon name="search" size={18} />
            Išči
          </button>
        </form>
      </PageHeader>
      <Section tight>
        <Container width="prose" className="max-w-3xl">
          {!term ? (
            <p className="text-body text-ink-2">Iščete lahko po oznanilih, dogodkih, novicah, straneh in dokumentih.</p>
          ) : results.length ? (
            <>
              <p className="mb-6 text-small text-ink-3" role="status">
                {results.length} zadetkov za »{term}«
              </p>
              <ul className="divide-y divide-stone border-y border-stone">
                {results.map((r) => {
                  const href = r._type === "parishDocument" ? (r.fileUrl ? `${r.fileUrl}?dl=` : routes.documents) : pathForDocument(r._type, r.slug);
                  if (!href) return null;
                  const external = href.startsWith("http");
                  const rawDate = typeof r.date === "string" ? r.date : null;
                  const date = rawDate ? formatDate(rawDate) : null;
                  return (
                    <li key={r._id} className="py-4">
                      <div className="flex flex-wrap items-center gap-2 text-meta text-ink-3">
                        <Tag>{SEARCH_TYPE_LABEL[r._type] ?? r._type}</Tag>
                        {date ? <span>{date}</span> : null}
                      </div>
                      <h2 className="mt-1 font-serif text-h3 text-ink">
                        {external ? (
                          <a href={href} className="hover:underline">
                            {r.title}
                          </a>
                        ) : (
                          <Link href={href} className="hover:underline">
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
