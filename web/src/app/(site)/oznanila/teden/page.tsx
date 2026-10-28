import type { Metadata } from "next";
import Link from "next/link";
import { getSettings } from "@/sanity/data";
import { getBulletinList } from "@/lib/data/bulletins";
import { buildMetadata } from "@/lib/seo";
import { routes } from "@/lib/routes";
import { Breadcrumbs, Container, EmptyState, PageHeader, Section } from "@/components/ui/primitives";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSettings();
  return buildMetadata({ settings, title: "Vsa oznanila", path: routes.bulletins });
}

export default async function BulletinsPage() {
  const list = await getBulletinList();
  return (
    <>
      <PageHeader
        title="Vsa oznanila"
        accent="oznanila"
        lede="Objavljena oznanila župnije, najnovejša prva."
        eyebrow={
          <Breadcrumbs items={[{ label: "Oznanila", href: routes.announcements }, { label: "Vsa oznanila" }]} />
        }
      />
      <Section>
        <Container>
          {list.length ? (
            <ul className="grid gap-4 md:grid-cols-2">
              {list.map((b) => (
                <li key={b.id}>
                  <Link
                    href={routes.bulletin(b.periodStart)}
                    className="flex min-h-16 items-center justify-between gap-4 rounded-lg bg-surface px-6 py-4 no-underline shadow-soft transition-[transform,box-shadow] duration-500 ease-out-soft hover:-translate-y-0.5 hover:shadow-lift motion-reduce:transform-none"
                  >
                    <span className="text-[1.25rem] font-bold tracking-[-0.035em]">{b.label}</span>
                    <span className="text-right text-small font-medium text-ink-3">{b.itemCount} {b.itemCount === 1 ? "obvestilo" : b.itemCount === 2 ? "obvestili" : b.itemCount < 5 && b.itemCount > 0 ? "obvestila" : "obvestil"}{b.hasPdf ? " · PDF" : ""}</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="Oznanil še ni" />
          )}
        </Container>
      </Section>
    </>
  );
}
