import type { Metadata } from "next";
import Link from "next/link";
import { getBulletinList, getSettings } from "@/sanity/data";
import { buildMetadata } from "@/lib/seo";
import { routes } from "@/lib/routes";
import { formatDateSpan } from "@/lib/dates";
import { Breadcrumbs, Container, EmptyState, PageHeader, Section } from "@/components/ui/primitives";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSettings();
  return buildMetadata({ settings, title: "Tedenska oznanila", path: routes.bulletins });
}

export default async function BulletinsPage() {
  const list = await getBulletinList();
  return (
    <>
      <PageHeader
        title="Tedenska oznanila"
        lede="Oznanila po tednih."
        eyebrow={
          <Breadcrumbs items={[{ label: "Oznanila", href: routes.announcements }, { label: "Tedenska oznanila" }]} />
        }
      />
      <Section tight tone="paper-2">
        <Container>
          {list.length ? (
            <ul className="grid gap-3 md:grid-cols-2">
              {list.map((b) => (
                <li key={b._id}>
                  <Link
                    href={routes.bulletin(b.weekStart)}
                    className="flex min-h-14 items-center justify-between gap-4 rounded-md border border-stone bg-paper px-5 py-3 no-underline hover:border-stone-2 [&_span:first-child]:hover:underline"
                  >
                    <span className="font-serif text-lede">{formatDateSpan(b.weekStart, b.weekEnd)}</span>
                    <span className="text-small text-ink-3">{b.itemCount ?? 0} oznanil</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="Tedenskih oznanil še ni" />
          )}
        </Container>
      </Section>
    </>
  );
}
