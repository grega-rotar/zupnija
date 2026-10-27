import type { Metadata } from "next";
import { getCatechesis, getSettings } from "@/sanity/data";
import { buildMetadata } from "@/lib/seo";
import { routes } from "@/lib/routes";
import { WEEKDAY_LABEL, formatTime, type Weekday } from "@/lib/dates";
import { clean } from "@/lib/clean";
import { AttachmentLink, RichText } from "@/components/sanity/RichText";
import { SanityImage, hasImage } from "@/components/sanity/SanityImage";
import { PersonCard } from "@/components/sections/PageSections";
import { PageHero } from "@/components/layout/PageHero";
import { Card, Container, EmptyState, Notice, Section, SectionHeading, TextLink } from "@/components/ui/primitives";

export async function generateMetadata(): Promise<Metadata> {
  const [settings, data] = await Promise.all([getSettings(), getCatechesis(false)]);
  return buildMetadata({
    settings,
    title: data.page?.title || "Verouk",
    description: `Verouk v župniji Pirniče${data.page?.schoolYear ? ` — veroučno leto ${data.page.schoolYear}` : ""}: urnik skupin, katehisti, vpis in dokumenti.`,
    path: routes.catechesis,
    seo: data.page?.seo,
    image: data.page?.image,
  });
}

export default async function CatechesisPage() {
  const [settings, { page, groups }] = await Promise.all([getSettings(), getCatechesis()]);
  const docs = (page?.documents ?? []).filter((d) => d.file?.asset?.url);

  return (
    <>
      <PageHero settings={settings} header="catechesisHeader" title={page?.title || "Verouk"} lede={page?.schoolYear ? `Veroučno leto ${page.schoolYear}` : undefined}>
        {page?.notice?.length ? (
          <Notice className="mt-8 bg-paper/15 text-paper [&_.prose]:text-paper">
            <RichText value={page.notice} />
          </Notice>
        ) : null}
      </PageHero>

      <Section tone="paper-2" tight>
        <Container>
          <SectionHeading title="Urnik skupin" />
          {groups.length ? (
            <Card padded={false} className="px-5 sm:px-8">
              {/* Phones: one card per group. */}
              <ul className="divide-y divide-stone md:hidden">
                {groups.map((g) => (
                  <li key={g._id} className="py-4">
                    <h3 className="font-serif text-lede text-ink">{g.title}</h3>
                    <dl className="mt-1.5 grid grid-cols-[5.5rem_1fr] gap-x-3 gap-y-1 text-small">
                      <dt className="text-ink-3">Termin</dt>
                      <dd className="text-ink">{sessionsLine(g.sessions)}</dd>
                      {g.sessions?.some((x) => x.location) ? (
                        <>
                          <dt className="text-ink-3">Prostor</dt>
                          <dd className="text-ink-2">{g.sessions.map((x) => x.location).filter(Boolean).join(", ")}</dd>
                        </>
                      ) : null}
                      {g.catechist?.name || g.catechistName ? (
                        <>
                          <dt className="text-ink-3">Katehet</dt>
                          <dd className="text-ink-2">{g.catechist?.name ?? g.catechistName}</dd>
                        </>
                      ) : null}
                    </dl>
                    {g.notes?.length ? <RichText value={g.notes} size="sm" className="mt-2 text-ink-2" /> : null}
                    <GroupDocuments docs={g.documents} />
                  </li>
                ))}
              </ul>

              {/* Larger screens: a table. */}
              <table className="hidden w-full border-collapse text-left md:table">
                <thead>
                  <tr className="border-b border-ink text-small text-ink-3">
                    <th scope="col" className="py-2 pr-4 font-medium">
                      Skupina
                    </th>
                    <th scope="col" className="py-2 pr-4 font-medium">
                      Termin
                    </th>
                    <th scope="col" className="py-2 pr-4 font-medium">
                      Prostor
                    </th>
                    <th scope="col" className="py-2 font-medium">
                      Katehet
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone">
                  {groups.map((g) => (
                    <tr key={g._id} className="align-top [&>*]:py-4">
                      <th scope="row" className="py-3 pr-4 font-serif text-lede font-medium text-ink">
                        {g.title}
                        {g.notes?.length ? <RichText value={g.notes} size="sm" className="mt-1 font-sans text-ink-2" /> : null}
                        <GroupDocuments docs={g.documents} />
                      </th>
                      <td className="py-3 pr-4 text-body">
                        {g.sessions?.length ? (
                          <ul className="space-y-0.5">
                            {g.sessions.map((x) => (
                              <li key={x._key} className="whitespace-nowrap">
                                <span className="capitalize">{WEEKDAY_LABEL[clean(x.weekday) as Weekday] ?? x.weekday}</span>{" "}
                                <span className="tnum font-medium">{formatTime(x.time)}</span>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <span className="text-ink-3">po dogovoru</span>
                        )}
                      </td>
                      <td className="py-3 pr-4 text-body text-ink-2">
                        {g.sessions?.map((x) => x.location).filter(Boolean).join(", ") || "—"}
                      </td>
                      <td className="py-3 text-body text-ink-2">{g.catechist?.name ?? g.catechistName ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          ) : (
            <EmptyState
              title={page?.schoolYear ? `Urnik za ${page.schoolYear} še ni objavljen` : "Urnik verouka še ni objavljen"}
              text="Urnik bo objavljen pred začetkom veroučnega leta."
            />
          )}
        </Container>
      </Section>

      {page?.intro?.length || page?.enrollment?.length || page?.contact || docs.length ? (
        <Section tight>
          <Container className="grid gap-12 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:gap-16">
            <div>
              {hasImage(page?.image) ? (
                <SanityImage image={page.image} aspect={3 / 2} sizes="(min-width: 1024px) 40rem, 100vw" maxWidth={1400} className="mb-8 rounded-md" />
              ) : null}
              <RichText value={page?.intro} size="lg" />
              {page?.enrollment?.length ? (
                <section className="mt-10">
                  <h2 className="mb-4 text-h2">Vpis</h2>
                  <RichText value={page.enrollment} />
                </section>
              ) : null}
            </div>
            <aside className="space-y-6">
              {page?.contact ? (
                <Card>
                  <h2 className="mb-4 text-h3">Kontakt za verouk</h2>
                  <PersonCard person={page.contact} />
                </Card>
              ) : null}
              {docs.length ? (
                <div>
                  <h2 className="mb-3 text-h3">Dokumenti</h2>
                  <ul className="space-y-2">
                    {docs.map((d) => (
                      <li key={d._id}>
                        <AttachmentLink attachment={{ title: d.title, file: d.file }} />
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              <p className="text-small text-ink-2">
                Priprava na prvo sveto obhajilo in birmo: <TextLink href={routes.sacraments}>zakramenti</TextLink>
              </p>
            </aside>
          </Container>
        </Section>
      ) : null}
    </>
  );
}

type Session = { _key: string; weekday: string; time: string; location: string | null };
type GroupDoc = { _id: string; title: string; file: { asset: { url: string; extension: string | null } | null } | null };

function sessionsLine(sessions: Session[] | null): string {
  if (!sessions?.length) return "po dogovoru";
  return sessions
    .map((x) => {
      const day = WEEKDAY_LABEL[clean(x.weekday) as Weekday] ?? x.weekday;
      return `${day.charAt(0).toUpperCase()}${day.slice(1)} ${formatTime(x.time)}`;
    })
    .join(", ");
}

function GroupDocuments({ docs }: { docs: GroupDoc[] | null }) {
  const list = (docs ?? []).filter((d) => d.file?.asset?.url);
  if (!list.length) return null;
  return (
    <ul className="mt-1 space-y-0.5 font-sans text-meta">
      {list.map((d) => (
        <li key={d._id}>
          <a href={`${d.file!.asset!.url}?dl=`} className="text-moss underline underline-offset-4">
            {d.title}
          </a>
        </li>
      ))}
    </ul>
  );
}
