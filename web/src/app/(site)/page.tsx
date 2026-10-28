import type { Metadata } from "next";
import { getChurches, getHomeArticles, getHomePage, getSettings } from "@/sanity/data";
import { getCurrentBulletin } from "@/lib/data/bulletins";
import { getHomeEvents, getUpcomingEvents } from "@/lib/data/events";
import { getTodayBlock } from "@/lib/data/today";
import { getLiturgicalDay } from "@/lib/liturgy/day";
import { buildMetadata } from "@/lib/seo";
import { routes } from "@/lib/routes";
import { HomeHero } from "@/components/home/HomeHero";
import { ThisWeek } from "@/components/home/ThisWeek";
import { Churches, Giving, News } from "@/components/home/Sections";
import { Reveal } from "@/components/home/Reveal";
import { PrayerBand } from "@/components/home/PrayerBand";
import s from "@/components/home/home.module.css";

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

/**
 * The homepage (design v4, tasks/prototype-homepage-v4.html): the photograph
 * with the "Danes" widget, "Ta teden v župniji", news, churches, giving.
 * Rendered per request (the site layout is force-dynamic), so "že mimo" and
 * the countdown are never stale.
 */
export default async function HomePage() {
  const [settings, home, { block, week }, bulletin, featured, upcoming, churches, articles] = await Promise.all([
    getSettings(),
    getHomePage(),
    getTodayBlock(),
    getCurrentBulletin(),
    getHomeEvents(1),
    getUpcomingEvents(1),
    getChurches(),
    getHomeArticles(),
  ]);
  const liturgy = await getLiturgicalDay(block.date);
  const parishName = settings?.name || "Župnija Pirniče";

  return (
    <div className={s.root}>
      <HomeHero home={home} parishName={parishName} block={block} />
      <ThisWeek date={block.date} liturgy={liturgy} event={featured[0] ?? upcoming[0] ?? null} bulletin={bulletin} week={week} />
      <News articles={articles} />
      <PrayerBand />
      <Churches churches={churches} />
      <Giving donations={settings?.donations} />
      <Reveal />
    </div>
  );
}
