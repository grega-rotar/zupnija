import type { Metadata } from "next";
import Link from "next/link";
import {
  getActiveSpecialPeriod,
  getChurches,
  getHomeAnnouncements,
  getHomeArticles,
  getHomeGalleries,
  getHomePage,
  getHomeSpecialPeriod,
  getSettings,
} from "@/sanity/data";
import { getUpcomingMasses } from "@/lib/data/masses";
import { getCurrentBulletin } from "@/lib/data/bulletins";
import { getHomeEvents } from "@/lib/data/events";
import { buildMetadata } from "@/lib/seo";
import { hrefFor, isExternalHref } from "@/lib/links";
import { routes } from "@/lib/routes";
import { Hero } from "@/components/home/Hero";
import { Today } from "@/components/home/Today";
import { SpecialPeriodFeature } from "@/components/home/SpecialPeriodFeature";
import { AnnouncementList } from "@/components/announcements/AnnouncementCard";
import { EventCard } from "@/components/events/EventCard";
import { ChurchCard } from "@/components/churches/ChurchCard";
import { ArticleCard } from "@/components/articles/ArticleCard";
import { GalleryCard } from "@/components/gallery/GalleryCard";
import { ContactBlock } from "@/components/contact/ContactBlock";
import { RichText } from "@/components/sanity/RichText";
import { SanityImage, hasImage } from "@/components/sanity/SanityImage";
import { Container, Section, SectionHeading, TextLink } from "@/components/ui/primitives";

export async function generateMetadata(): Promise<Metadata> {
  const [settings, home] = await Promise.all([getSettings(), getHomePage(false)]);
  return buildMetadata({
    settings,
    path: routes.home,
    seo: home?.seo,
    image: home?.heroImage,
    description: home?.heroText,
  });
}

export default async function HomePage() {
  const [settings, home, masses, bulletin, period, activePeriod, announcements, events, churches, articles, galleries] =
    await Promise.all([
      getSettings(),
      getHomePage(),
      getUpcomingMasses(7),
      getCurrentBulletin(),
      getHomeSpecialPeriod(),
      getActiveSpecialPeriod(),
      getHomeAnnouncements(),
      getHomeEvents(),
      getChurches(),
      getHomeArticles(),
      getHomeGalleries(),
    ]);

  const parishName = settings?.name || "Župnija Pirniče";
  const welcome = home?.welcome;
  const welcomeHref = hrefFor(welcome?.link);
  const showWelcome = Boolean(welcome?.title || welcome?.text?.length);

  return (
    <>
      <Hero home={home} parishName={parishName} tagline={settings?.tagline} />

      <Today days={masses.days} today={masses.today} time={masses.time} bulletin={bulletin} tile={home?.tile} />

      {events.length ? (
        <Section tight>
          <Container>
            <SectionHeading title="Prihajajoči dogodki" action={{ label: "Vsi dogodki", href: routes.events }} />
            <div className="grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
              {events.slice(0, 4).map((event) => (
                <EventCard key={event._id} event={event} />
              ))}
            </div>
          </Container>
        </Section>
      ) : null}

      <SpecialPeriodFeature period={period} />

      {announcements.length ? (
        <Section tight tone="paper-2" className="border-y border-stone">
          <Container>
            <SectionHeading title="Oznanila" action={{ label: "Vsa oznanila", href: routes.announcements }} />
            <AnnouncementList items={announcements.slice(0, 3)} compact />
          </Container>
        </Section>
      ) : null}

      {showWelcome ? (
        <Section>
          <Container className="grid gap-10 md:grid-cols-2 md:items-center md:gap-16">
            <div>
              {welcome?.title ? <h2 className="text-h2">{welcome.title}</h2> : null}
              <RichText value={welcome?.text} size="lg" className="mt-5 text-ink-2" />
              {welcomeHref && welcome?.link?.label ? (
                <div className="mt-6">
                  <TextLink href={welcomeHref} external={isExternalHref(welcomeHref)}>
                    {welcome.link.label}
                  </TextLink>
                </div>
              ) : null}
            </div>
            {hasImage(welcome?.image) ? (
              <SanityImage image={welcome.image} aspect={4 / 3} sizes="(min-width: 768px) 50vw, 100vw" maxWidth={1200} className="rounded-md" />
            ) : null}
          </Container>
        </Section>
      ) : null}

      {churches.length ? (
        <Section tight tone="paper-2" className="border-y border-stone">
          <Container>
            <SectionHeading title="Naše cerkve" action={{ label: "Vse cerkve", href: routes.churches }} />
            <div className="grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
              {churches.slice(0, 3).map((church) => (
                <ChurchCard key={church._id} church={church} />
              ))}
            </div>
          </Container>
        </Section>
      ) : null}

      {articles.length || galleries.length ? (
        <Section tight>
          <Container>
            <SectionHeading title="Iz župnijskega življenja" action={{ label: "Vse novice", href: routes.news }} />
            {articles.length ? (
              <div className="grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
                {articles.map((article) => (
                  <ArticleCard key={article._id} article={article} />
                ))}
              </div>
            ) : null}
            {galleries.length ? (
              <div className="mt-14">
                <div className="mb-6 flex items-baseline justify-between gap-6">
                  <h3 className="text-h3">Galerije</h3>
                  <TextLink href={routes.galleries}>Vse galerije</TextLink>
                </div>
                <div className="grid grid-cols-2 gap-x-6 gap-y-8 lg:grid-cols-3">
                  {galleries.map((gallery) => (
                    <GalleryCard key={gallery._id} gallery={gallery} />
                  ))}
                </div>
              </div>
            ) : null}
          </Container>
        </Section>
      ) : null}

      <Section tight tone="paper-2" className="border-t border-stone">
        <Container>
          <SectionHeading title="Kontakt in uradne ure" action={{ label: "Vse o kontaktu", href: routes.contact }} />
          <ContactBlock settings={settings} officeHoursOverride={activePeriod?.officeHoursNote} />
          <p className="mt-10 text-body text-ink-2">
            Starši veroučencev:{" "}
            <Link href={routes.catechesis} className="font-medium text-moss underline decoration-moss/40 underline-offset-4 hover:decoration-moss">
              urnik in informacije o verouku
            </Link>
            .
          </p>
        </Container>
      </Section>
    </>
  );
}
