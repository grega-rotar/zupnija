import Link from "next/link";

const TABS = [
  { href: "/ljudje", label: "Osebe" },
  { href: "/ljudje/narocniki", label: "Naročniki" },
] as const;

const chip =
  "chip aria-[current=page]:bg-moss aria-[current=page]:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold";

/** The tabs of Ljudje (owner only): the editors, and the newsletter's subscribers. */
export function PeopleTabs({ current }: { current: "/ljudje" | "/ljudje/narocniki" }) {
  return (
    <nav className="chips mb-5" aria-label="Ljudje">
      {TABS.map((t) => (
        <Link key={t.href} href={t.href} className={chip} aria-current={t.href === current ? "page" : undefined} prefetch={false}>
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
