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
import { Button, Container, Section, SectionHeading, Split, TextLink, headline, tile } from "@/components/ui/primitives";

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
  return <h2 className={cn("mx-auto mb-10 max-w-3xl text-center lg:mb-14", headline.h2, className)}>{title}</h2>;
}

function HeroSection({ section }: { section: SectionOf<"sectionHero"> }) {
  return (
    <section className="py-12 lg:py-20">
      <Container>
        <SanityImage
          image={section.image}
          aspect={21 / 9}
          sizes="100vw"
          maxWidth={2000}
          priority
          className="overflow-hidden rounded-[2rem] shadow-soft max-sm:aspect-[4/3]! sm:rounded-xl"
          imgClassName="[filter:saturate(.55)_sepia(.12)]"
        />
        {section.title || section.text ? (
          <div className="mx-auto mt-10 max-w-3xl text-center">
            {section.title ? <h2 className={headline.h2}>{section.title}</h2> : null}
            {section.text ? <p className="lede mx-auto mt-4 max-w-[40rem] text-balance">{section.text}</p> : null}
          </div>
        ) : null}
      </Container>
    </section>
  );
}

function RichTextSection({ section }: { section: SectionOf<"sectionRichText"> }) {
  return (
    <Section>
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
    <Section>
      <Container className="grid gap-10 md:grid-cols-2 md:items-center md:gap-16">
        <div className={cn(imageLeft && "md:order-2")}>
          {section.title ? <h2 className={cn("mb-5", headline.h2)}>{section.title}</h2> : null}
          <RichText value={section.body} size="lg" />
          {href && section.link?.label ? (
            <div className="mt-4">
              <TextLink href={href} external={isExternalHref(href)}>
                {section.link.label}
              </TextLink>
            </div>
          ) : null}
        </div>
        <SanityImage
          image={section.image}
          aspect={4 / 3}
          sizes="(min-width: 768px) 50vw, 100vw"
          maxWidth={1200}
          className={cn("overflow-hidden rounded-lg shadow-soft", imageLeft && "md:order-1")}
          imgClassName="saturate-[.7]"
        />
      </Container>
    </Section>
  );
}

function QuoteSection({ section }: { section: SectionOf<"sectionQuote"> }) {
  return (
    <Section>
      <Container>
        <figure className="mx-auto max-w-4xl text-center">
          <blockquote className="text-balance font-serif text-[clamp(2rem,1.4rem+2.6vw,3.5rem)] italic leading-[1.12] tracking-[-0.015em] text-ink">{section.quote}</blockquote>
          {section.source ? <figcaption className="eyebrow mt-5">{section.source}</figcaption> : null}
        </figure>
      </Container>
    </Section>
  );
}

function GallerySection({ section }: { section: SectionOf<"sectionGallery"> }) {
  const images = section.gallery?.images ?? section.images;
  const title = section.title ?? section.gallery?.title;
  return (
    <Section>
      <Container>
        {title ? (
          <SectionHeading
            title={title}
            eyebrow="Fotografije"
            action={
              section.gallery?.slug
                ? {
                    label: "Odpri galerijo",
                    href: routes.gallery(section.gallery.slug),
                  }
                : undefined
            }
          />
        ) : null}
        <PhotoGrid images={images} title={title ?? "Galerija"} />
      </Container>
    </Section>
  );
}

export function PersonCard({
  person,
  card,
}: {
  card?: boolean;
  person: {
    name: string;
    role?: string | null;
    roleTitle?: string | null;
    email?: string | null;
    phone?: string | null;
    showContact?: boolean | null;
    photo?: React.ComponentProps<typeof SanityImage>["image"];
    bio?: React.ComponentProps<typeof RichText>["value"];
  };
}) {
  const role = personRole({
    role: clean(person.role),
    roleTitle: person.roleTitle,
  });
  return (
    <article className={cn("flex gap-5", card && cn(tile, "p-5 sm:p-6"))}>
      {hasImage(person.photo) ? (
        <SanityImage image={person.photo} aspect={4 / 5} sizes="7rem" maxWidth={320} className="w-24 shrink-0 overflow-hidden rounded-md sm:w-28" imgClassName="saturate-[.7]" />
      ) : (
        <div className="flex aspect-[4/5] w-24 shrink-0 items-end justify-center rounded-md bg-paper-2 sm:w-28" aria-hidden="true">
          <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" className="text-stone-2">
            <circle cx="12" cy="9" r="4" />
            <path d="M4 22c0-4 4-6 8-6s8 2 8 6" />
          </svg>
        </div>
      )}
      <div className="min-w-0">
        <h3 className="text-[1.375rem] font-bold leading-snug tracking-[-0.035em] text-ink">{person.name}</h3>
        {role ? <p className="eyebrow mt-0.5">{role}</p> : null}
        <RichText value={person.bio} size="sm" className="mt-2 text-ink-2" />
        {person.showContact !== false && (person.email || person.phone) ? (
          <p className="mt-2 text-small">
            {person.phone ? (
              <a href={`tel:${person.phone.replace(/[^\d+]/g, "")}`} className="font-medium text-gold-ink hover:text-moss-deep">
                {person.phone}
              </a>
            ) : null}
            {person.phone && person.email ? <span className="text-ink-3"> · </span> : null}
            {person.email ? (
              <a href={`mailto:${person.email}`} className="font-medium text-gold-ink hover:text-moss-deep">
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
    <Section>
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
    <Section>
      <Container>
        <SectionTitle title={section.title} />
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
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
    <Section>
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
    <Section>
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
    <Section>
      <Container>
        <SectionTitle title={section.title} />
        <ContactBlock settings={settings} officeHoursOverride={period?.officeHoursNote} />
        {section.showForm ? (
          <div className={cn(tile, "mx-auto mt-5 max-w-2xl p-6 sm:p-10")}>
            <h3 className="mb-6 text-[1.75rem] font-bold tracking-[-0.04em]">
              Pišite <span className="accent">nam</span>
            </h3>
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
    <Section>
      <Container>
        <SectionHeading eyebrow="Dogodki" title={section.title ?? "Prihajajoči dogodki"} action={{ label: "Vsi dogodki", href: routes.events }} />
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
    <Section>
      <Container>
        <SectionHeading eyebrow="Bogoslužje" title={section.title ?? "Svete maše"} action={{ label: "Vse o svetih mašah", href: routes.masses }} />
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
    <Section tight={!first}>
      <Container>
        <div className="rounded-lg bg-[linear-gradient(165deg,var(--color-gold-soft)_0%,#fff_72%)] px-6 py-14 text-center shadow-soft sm:px-12 sm:py-20">
          <h2 className={cn("mx-auto max-w-3xl", headline.h2)}>{section.title}</h2>
          {section.text ? <p className="lede mx-auto mt-4 max-w-[40rem] text-balance">{section.text}</p> : null}
          {href && section.link?.label ? (
            <div className="mt-8">
              <Button href={href} external={isExternalHref(href)} size="lg" icon={isExternalHref(href) ? "external" : "arrow-right"}>
                {section.link.label}
              </Button>
            </div>
          ) : null}
        </div>
      </Container>
    </Section>
  );
}
