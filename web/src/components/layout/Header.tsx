import { routes } from "@/lib/routes";
import { hasPrayerPage } from "@/lib/prayer/page";
import { Nav, type NavLink } from "./Nav";

/** The pill's links, as in the approved design (tasks/proto-v4/partials/a.html). */
const links: NavLink[] = [
  { label: "Maše", href: routes.masses },
  { label: "Oznanila", href: routes.announcements },
  { label: "Dogodki", href: routes.events },
  { label: "Zakramenti", href: routes.sacraments },
  { label: "Verouk", href: routes.catechesis },
  { label: "Župnija", href: routes.parish },
  { label: "Kontakt", href: routes.contact },
];

/** The rest, in the phone menu only. */
const more: NavLink[] = [
  { label: "Mašni nameni", href: routes.intentions },
  { label: "Novice", href: routes.news },
  { label: "Galerije", href: routes.galleries },
  { label: "Cerkve", href: routes.churches },
  { label: "Skupine", href: routes.groups },
  { label: "Dokumenti", href: routes.documents },
  { label: "Iskanje", href: routes.search },
];

/**
 * Floating pill navigation: brand, seven links, "Daruj". "Molitev" takes
 * Verouk's place in the pill while /molitev has items (US-012); Verouk then
 * moves to the phone menu.
 */
export async function Header({ parishName }: { parishName: string }) {
  const prayer = await hasPrayerPage();
  const pill = prayer ? links.map((l) => (l.href === routes.catechesis ? { label: "Molitev", href: routes.prayer } : l)) : links;
  const rest = prayer ? [{ label: "Verouk", href: routes.catechesis }, ...more] : more;
  return <Nav parishName={parishName} links={pill} more={rest} give={{ label: "Daruj", href: `${routes.home}#darovi` }} />;
}
