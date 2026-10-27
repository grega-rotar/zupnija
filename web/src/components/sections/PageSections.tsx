import Link from "next/link";
import type { PAGE_QUERY_RESULT } from "@/sanity/types.generated";
import { getActiveSpecialPeriod, getCurrentSchedules, getSettings } from "@/sanity/data";
import { getUpcomingEvents } from "@/lib/data/events";
import { hrefFor, isExternalHref } from "@/lib/links";
import { clean } from "@/lib/clean";
import { personRole } from "@/lib/labels";
import { routes } from "@/lib/routes";
import { cn } from "@/lib/utils";
import { AttachmentLink, RichText } from "@/components/sanity/RichText";
import { SanityImage, hasImage } from "@/components/sanity/SanityImage";
import { PhotoGrid } from "@/components/gallery/PhotoGrid";
import { ChurchCard } from "@/components/churches/ChurchCard";
import { EventList } from "@/components/events/EventCard";
import { ScheduleTable } from "@/components/masses/ScheduleTable";
import { ContactBlock } from "@/components/contact/ContactBlock";
import { ContactForm } from "@/components/forms/ContactForm";
import { Faq } from "@/components/ui/Faq";
import { Button, Container, Section, Split, TextLink } from "@/components/ui/primitives";

type Sections = NonNullable<NonNullable<PAGE_QUERY_RESULT>["sections"]>;
type SectionOf<T extends Sections[number]["_type"]> = Extract<Sections[number], { _type: T }>;

/**
 * Renders the approved page sections in order. Each section owns its
 * vertical rhythm; the design system decides everything visual.
 */
export async function PageSections({ sections }: { sections: Sections | null | undefined }) {
  if (!sections?.length) return null;
  return (
    <>
      {sections.map((section, index) => {
        const first = index === 0;
        switch (section._type) {
          case "sectionHero":
            return <HeroSection key={section._key} section={section} />;
          case "sectionRichText":
            return <RichTextSection key={section._key} section={section} />;
          case "sectionTextImage":
            return <TextImageSection key={section._key} section={section} />;
          case "sectionQuote":
            return <QuoteSection key={section._key} section={section} />;
          case "sectionGallery":
            return <GallerySection key={section._key} section={section} />;
          case "sectionPeople":
            return <PeopleSection key={section._key} section={section} />;
          case "sectionChurches":
            return <ChurchesSection key={section._key} section={section} />;
          case "sectionFaq":
            return <FaqSection key={section._key} section={section} />;
          case "sectionDocuments":
            return <DocumentsSection key={section._key} section={section} />;
          case "sectionContact":
            return <ContactSection key={section._key} section={section} />;
          case "sectionEvents":
            return <EventsSection key={section._key} section={section} />;
          case "sectionMassSchedule":
            return <MassScheduleSection key={section._key} section={section} />;
          case "sectionCta":
            return <CtaSection key={section._key} section={section} first={first} />;
          default:
            return null;
        }
      })}
    </>
  );
}

function SectionTitle({ title, className }: { title?: string | null; className?: string }) {
  if (!title) return null;
  return <h2 className={cn("mb-8 text-h2", className)}>{title}</h2>;
}

function HeroSection({ section }: { section: SectionOf<"sectionHero"> }) {
  return (
    <section className="pb-10 sm:pb-14">
      <Container>
        <SanityImage image={section.image} aspect={21 / 9} sizes="100vw" maxWidth={2000} priority className="rounded-md max-sm:aspect-[4/3]" />
        {section.title || section.text ? (
          <div className="mt-6 max-w-prose">
            {section.title ? <h2 className="text-h2">{section.title}</h2> : null}
            {section.text ? <p className="mt-3 text-lede text-ink-2">{section.text}</p> : null}
          </div>
        ) : null}
      </Container>
    </section>
  );
}

function RichTextSection({ section }: { section: SectionOf<"sectionRichText"> }) {
  return (
    <Section tight>
      <Split title={section.title}>
        <RichText value={section.body} size="lg" />
      </Split>
    </Section>
  );
}

function TextImageSection({ section }: { section: SectionOf<"sectionTextImage"> }) {
  const imageLeft = clean(section.imageSide) === "left";
  const href = hrefFor(section.link);
  return (
    <Section tight>
      <Container className="grid gap-8 md:grid-cols-2 md:items-center md:gap-14">
        <div className={cn(imageLeft && "md:order-2")}>
          <SectionTitle title={section.title} className="mb-4" />
          <RichText value={section.body} size="lg" />
          {href && section.link?.label ? (
            <div className="mt-6">
              <TextLink href={href} external={isExternalHref(href)}>
                {section.link.label}
              </TextLink>
            </div>
          ) : null}
        </div>
        <SanityImage image={section.image} aspect={4 / 3} sizes="(min-width: 768px) 50vw, 100vw" maxWidth={1200} className={cn("rounded-md", imageLeft && "md:order-1")} />
      </Container>
    </Section>
  );
}

function QuoteSection({ section }: { section: SectionOf<"sectionQuote"> }) {
  return (
    <Section tight>
      <Container>
        <figure className="max-w-3xl border-l-2 border-gold pl-6 sm:pl-8">
          <blockquote className="font-serif text-h3 leading-snug text-ink sm:text-h2 sm:leading-snug">{section.quote}</blockquote>
          {section.source ? <figcaption className="mt-3 text-small text-ink-3">{section.source}</figcaption> : null}
        </figure>
      </Container>
    </Section>
  );
}

function GallerySection({ section }: { section: SectionOf<"sectionGallery"> }) {
  const images = section.gallery?.images ?? section.images;
  const title = section.title ?? section.gallery?.title;
  return (
    <Section tight>
      <Container>
        <div className="mb-6 flex flex-wrap items-baseline justify-between gap-4">
          <SectionTitle title={title} className="mb-0" />
          {section.gallery?.slug ? (
            <Link href={routes.gallery(section.gallery.slug)} className="text-small text-moss underline underline-offset-4">
              Odpri galerijo
            </Link>
          ) : null}
        </div>
        <PhotoGrid images={images} title={title ?? "Galerija"} />
      </Container>
    </Section>
  );
}

export function PersonCard({ person, card }: { card?: boolean; person: { name: string; role?: string | null; roleTitle?: string | null; email?: string | null; phone?: string | null; showContact?: boolean | null; photo?: React.ComponentProps<typeof SanityImage>["image"]; bio?: React.ComponentProps<typeof RichText>["value"] } }) {
  const role = personRole({ role: clean(person.role), roleTitle: person.roleTitle });
  return (
    <article className={cn("flex gap-5", card && "rounded-md border border-stone bg-paper p-5")}>
      {hasImage(person.photo) ? (
        <SanityImage image={person.photo} aspect={4 / 5} sizes="7rem" maxWidth={320} className="w-24 shrink-0 rounded-sm sm:w-28" />
      ) : (
        <div className="flex aspect-[4/5] w-24 shrink-0 items-end justify-center rounded-sm bg-paper-2 sm:w-28" aria-hidden="true">
          <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" className="text-stone-2">
            <circle cx="12" cy="9" r="4" />
            <path d="M4 22c0-4 4-6 8-6s8 2 8 6" />
          </svg>
        </div>
      )}
      <div className="min-w-0">
        <h3 className="font-serif text-h3 text-ink">{person.name}</h3>
        {role ? <p className="text-small text-ink-2">{role}</p> : null}
        <RichText value={person.bio} size="sm" className="mt-2 text-ink-2" />
        {person.showContact !== false && (person.email || person.phone) ? (
          <p className="mt-2 text-small">
            {person.phone ? (
              <a href={`tel:${person.phone.replace(/[^\d+]/g, "")}`} className="text-moss underline underline-offset-4">
                {person.phone}
              </a>
            ) : null}
            {person.phone && person.email ? <span className="text-ink-3"> · </span> : null}
            {person.email ? (
              <a href={`mailto:${person.email}`} className="text-moss underline underline-offset-4">
                {person.email}
              </a>
            ) : null}
          </p>
        ) : null}
      </div>
    </article>
  );
}

function PeopleSection({ section }: { section: SectionOf<"sectionPeople"> }) {
  if (!section.people?.length) return null;
  return (
    <Section tight tone="paper-2">
      <Container>
        <SectionTitle title={section.title} />
        <div className="grid gap-5 md:grid-cols-2">
          {section.people.map((p) => (
            <PersonCard key={p._id} person={p} card />
          ))}
        </div>
      </Container>
    </Section>
  );
}

function ChurchesSection({ section }: { section: SectionOf<"sectionChurches"> }) {
  if (!section.churches?.length) return null;
  return (
    <Section tight tone="paper-2">
      <Container>
        <SectionTitle title={section.title} />
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3 lg:gap-6">
          {section.churches.map((c) => (
            <ChurchCard key={c._id} church={c} />
          ))}
        </div>
      </Container>
    </Section>
  );
}

function FaqSection({ section }: { section: SectionOf<"sectionFaq"> }) {
  return (
    <Section tight>
      <Split title={section.title}>
        <Faq items={section.items ?? []} />
      </Split>
    </Section>
  );
}

function DocumentsSection({ section }: { section: SectionOf<"sectionDocuments"> }) {
  const docs = (section.documents ?? []).filter((d) => d.file?.asset?.url);
  if (!docs.length) return null;
  return (
    <Section tight>
      <Split title={section.title}>
        <ul className="grid gap-2">
          {docs.map((d) => (
            <li key={d._id}>
              <AttachmentLink attachment={{ title: d.title, file: d.file }} />
              {d.description ? <p className="mt-1 pl-1 text-meta text-ink-3">{d.description}</p> : null}
            </li>
          ))}
        </ul>
      </Split>
    </Section>
  );
}

async function ContactSection({ section }: { section: SectionOf<"sectionContact"> }) {
  const [settings, period] = await Promise.all([getSettings(), getActiveSpecialPeriod()]);
  return (
    <Section tight tone="paper-2">
      <Container>
        <SectionTitle title={section.title} />
        <ContactBlock settings={settings} officeHoursOverride={period?.officeHoursNote} />
        {section.showForm ? (
          <div className="mt-12 max-w-2xl">
            <h3 className="mb-4 text-h3">Pišite nam</h3>
            <ContactForm />
          </div>
        ) : null}
      </Container>
    </Section>
  );
}

async function EventsSection({ section }: { section: SectionOf<"sectionEvents"> }) {
  const events = await getUpcomingEvents(section.limit ?? 4);
  return (
    <Section tight>
      <Container>
        <div className="mb-8 flex flex-wrap items-baseline justify-between gap-4">
          <SectionTitle title={section.title ?? "Prihajajoči dogodki"} className="mb-0" />
          <TextLink href={routes.events}>Vsi dogodki</TextLink>
        </div>
        <EventList events={events} />
      </Container>
    </Section>
  );
}

async function MassScheduleSection({ section }: { section: SectionOf<"sectionMassSchedule"> }) {
  const schedules = await getCurrentSchedules();
  const regular = schedules.filter((s) => !s.validFrom && !s.validUntil);
  if (!regular.length) return null;
  return (
    <Section tight>
      <Container>
        <div className="mb-8 flex flex-wrap items-baseline justify-between gap-4">
          <SectionTitle title={section.title ?? "Svete maše"} className="mb-0" />
          <TextLink href={routes.masses}>Vse o svetih mašah</TextLink>
        </div>
        <div className="space-y-12">
          {regular.map((s) => (
            <ScheduleTable key={s._id} schedule={s} churchId={section.church?._id} showTitle={regular.length > 1} />
          ))}
        </div>
      </Container>
    </Section>
  );
}

function CtaSection({ section, first }: { section: SectionOf<"sectionCta">; first: boolean }) {
  const href = hrefFor(section.link);
  return (
    <Section tight={!first} tone="paper-2">
      <Container className="max-w-3xl text-center">
        <h2 className="text-h2">{section.title}</h2>
        {section.text ? <p className="mx-auto mt-3 max-w-prose text-lede text-ink-2">{section.text}</p> : null}
        {href && section.link?.label ? (
          <div className="mt-7">
            <Button href={href} external={isExternalHref(href)} size="lg" icon={isExternalHref(href) ? "external" : "arrow-right"}>
              {section.link.label}
            </Button>
          </div>
        ) : null}
      </Container>
    </Section>
  );
}
