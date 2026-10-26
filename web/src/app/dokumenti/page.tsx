import type { Metadata } from "next";
import { getDocuments, getSettings } from "@/sanity/data";
import { buildMetadata } from "@/lib/seo";
import { routes } from "@/lib/routes";
import { formatDate } from "@/lib/dates";
import { clean } from "@/lib/clean";
import { DOCUMENT_CATEGORY_LABEL } from "@/lib/labels";
import { AttachmentLink } from "@/components/sanity/RichText";
import { Breadcrumbs, Container, EmptyState, PageHeader, Section } from "@/components/ui/primitives";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSettings();
  return buildMetadata({ settings, title: "Dokumenti", description: "Obrazci, prijavnice in drugi dokumenti župnije Pirniče.", path: routes.documents });
}

const ORDER = ["forms", "catechesis", "bulletins", "newsletter", "info", "other"];

export default async function DocumentsPage() {
  const docs = await getDocuments();
  const groups = new Map<string, typeof docs>();
  for (const d of docs) {
    const cat = clean(d.category) || "other";
    groups.set(cat, [...(groups.get(cat) ?? []), d]);
  }
  const ordered = ORDER.filter((c) => groups.has(c));

  return (
    <>
      <PageHeader
        title="Dokumenti"
        lede="Obrazci, prijavnice in informacije za prenos."
        eyebrow={<Breadcrumbs items={[{ label: "Župnija", href: routes.parish }, { label: "Dokumenti" }]} />}
      />
      <Section tight tone="paper-2">
        <Container width="prose" className="max-w-3xl">
          {ordered.length ? (
            <div className="space-y-12">
              {ordered.map((cat) => (
                <section key={cat} aria-labelledby={`dok-${cat}`}>
                  <h2 id={`dok-${cat}`} className="mb-4 text-h3">
                    {DOCUMENT_CATEGORY_LABEL[cat] ?? cat}
                  </h2>
                  <ul className="space-y-2">
                    {groups.get(cat)!.map((d) => (
                      <li key={d._id}>
                        <AttachmentLink attachment={{ title: d.title, file: d.file }} />
                        {d.description || d.date ? (
                          <p className="mt-1 pl-1 text-meta text-ink-3">
                            {d.description}
                            {d.description && d.date ? " · " : ""}
                            {d.date ? formatDate(d.date) : ""}
                          </p>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          ) : (
            <EmptyState title="Dokumentov še ni" />
          )}
        </Container>
      </Section>
    </>
  );
}
