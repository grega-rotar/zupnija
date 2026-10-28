import type { Metadata } from "next";
import { getCatechesis, getSettings } from "@/sanity/data";
import { getCatechesisGroups, type PublicCatechesisGroup } from "@/lib/data/verouk";
import { buildMetadata } from "@/lib/seo";
import { routes } from "@/lib/routes";
import { WEEKDAY_LABEL, formatDayHeading, formatTime, type Weekday } from "@/lib/dates";
import { clean } from "@/lib/clean";
import { cn } from "@/lib/utils";
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
  const [settings, { page }, groups] = await Promise.all([getSettings(), getCatechesis(), getCatechesisGroups()]);
  const docs = (page?.documents ?? []).filter((d) => d.file?.asset?.url);

  return (
    <>
      <PageHero settings={settings} header="catechesisHeader" title={page?.title || "Verouk"} lede={page?.schoolYear ? `Veroučno leto ${page.schoolYear}` : undefined}>
        {page?.notice?.length ? (
          <Notice className="mx-auto mt-8 text-left">
            <RichText value={page.notice} />
          </Notice>
        ) : null}
      </PageHero>

      <Section>
        <Container>
          <SectionHeading eyebrow="Verouk" title="Urnik skupin" accent="skupin" />
          {groups.length ? (
            <Card padded={false} className="px-6 py-2 sm:px-8">
              {/* Phones: one card per group. */}
              <ul className="divide-y divide-stone/70 md:hidden">
                {groups.map((g) => (
                  <li key={g._id} className="py-4">
                    <h3 className="text-[1.125rem] font-bold tracking-[-0.025em] text-ink">{g.title}</h3>
                    <dl className="mt-1.5 grid grid-cols-[5.5rem_1fr] gap-x-3 gap-y-1 text-small">
                      <dt className="text-ink-3">Termin</dt>
                      <dd className="text-ink">{sessionsLine(g.sessions)}</dd>
                      {g.sessions?.some((x) => x.location) ? (
                        <>
                          <dt className="text-ink-3">Prostor</dt>
                          <dd className="text-ink-2">{g.sessions.map((x) => x.location).filter(Boolean).join(", ")}</dd>
                        </>
                      ) : null}
                    </dl>
                    <Cancellations items={g.cancellations} className="mt-2" />
                  </li>
                ))}
              </ul>

              {/* Larger screens: a table. */}
              <table className="hidden w-full border-collapse text-left md:table">
                <thead>
                  <tr className="border-b border-stone/70 text-small text-ink-3">
                    <th scope="col" className="py-4 pr-4 font-semibold">
                      Skupina
                    </th>
                    <th scope="col" className="py-4 pr-4 font-semibold">
                      Termin
                    </th>
                    <th scope="col" className="py-4 font-semibold">
                      Prostor
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone/70">
                  {groups.map((g) => (
                    <tr key={g._id} className="align-top [&>*]:py-4">
                      <th scope="row" className="py-3 pr-4 text-[1.125rem] font-bold tracking-[-0.025em] text-ink">
                        {g.title}
                        <Cancellations items={g.cancellations} className="mt-1 font-sans" />
                      </th>
                      <td className="py-3 pr-4 text-body">
                        {g.sessions?.length ? (
                          <ul className="space-y-0.5">
                            {g.sessions.map((x) => (
                              <li key={x._key} className="whitespace-nowrap">
                                <span className="capitalize">{WEEKDAY_LABEL[clean(x.weekday) as Weekday] ?? x.weekday}</span>{" "}
                                <span className="tnum font-semibold">{formatTime(x.time)}</span>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <span className="text-ink-3">po dogovoru</span>
                        )}
                      </td>
                      <td className="py-3 text-body text-ink-2">
                        {g.sessions?.map((x) => x.location).filter(Boolean).join(", ") || "—"}
                      </td>
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
        <Section>
          <Container className="grid gap-12 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:gap-16">
            <div>
              {hasImage(page?.image) ? (
                <SanityImage image={page.image} aspect={3 / 2} sizes="(min-width: 1024px) 40rem, 100vw" maxWidth={1400} className="mb-10 overflow-hidden rounded-lg shadow-soft" imgClassName="saturate-[.7]" />
              ) : null}
              <RichText value={page?.intro} size="lg" />
              {page?.enrollment?.length ? (
                <section className="mt-10">
                  <h2 className="mb-4 text-[2rem] font-bold tracking-[-0.045em]">Vpis</h2>
                  <RichText value={page.enrollment} />
                </section>
              ) : null}
            </div>
            <aside className="space-y-5">
              {page?.contact ? (
                <Card>
                  <h2 className="mb-4 text-h3">Kontakt za verouk</h2>
                  <PersonCard person={page.contact} />
                </Card>
              ) : null}
              {docs.length ? (
                <div className="rounded-lg bg-surface p-6 shadow-soft sm:p-8">
                  <h2 className="mb-4 text-h3">Dokumenti</h2>
                  <ul className="space-y-2">
                    {docs.map((d) => (
                      <li key={d._id}>
                        <AttachmentLink attachment={{ title: d.title, file: d.file }} />
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              <p className="px-2 text-small text-ink-2">
                Priprava na prvo sveto obhajilo in birmo: <TextLink href={routes.sacraments}>zakramenti</TextLink>
              </p>
            </aside>
          </Container>
        </Section>
      ) : null}
    </>
  );
}

type Session = PublicCatechesisGroup["sessions"][number];

function sessionsLine(sessions: Session[] | null): string {
  if (!sessions?.length) return "po dogovoru";
  return sessions
    .map((x) => {
      const day = WEEKDAY_LABEL[clean(x.weekday) as Weekday] ?? x.weekday;
      return `${day.charAt(0).toUpperCase()}${day.slice(1)} ${formatTime(x.time)}`;
    })
    .join(", ");
}

/** Lessons cancelled in the editor ("Ta teden odpade"), with the message for parents. */
function Cancellations({ items, className }: { items: PublicCatechesisGroup["cancellations"]; className?: string }) {
  if (!items.length) return null;
  return (
    <ul className={cn("space-y-0.5 text-small font-normal", className)}>
      {items.map((c) => (
        <li key={c.date} className="text-alert">
          {formatDayHeading(c.date)}: odpade.
          {c.message ? <em className="ml-1 text-ink-2">{c.message}</em> : null}
        </li>
      ))}
    </ul>
  );
}
