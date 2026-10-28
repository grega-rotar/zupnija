import Link from "next/link";
import s from "./requests.module.css";

/** Tabs inside one editor screen (Maše: Nameni | Prošnje; Verouk: Ta teden | Vpisi), as links. */
export function ScreenTabs({ label, tabs, current }: { label: string; tabs: { href: string; label: string; count?: number }[]; current: string }) {
  return (
    <nav className={s.tabs} aria-label={label}>
      {tabs.map((t) => (
        <Link key={t.href} href={t.href} aria-current={t.href === current ? "page" : undefined} prefetch={false}>
          {t.label}
          {t.count ? (
            <span className={s.count}>
              {t.count}
              <span className="sr-only"> novih</span>
            </span>
          ) : null}
        </Link>
      ))}
    </nav>
  );
}

/** Maše in nameni: "Nameni" and "Prošnje (n)". */
export function MaseTabs({ current, requests }: { current: "/teden" | "/teden/prosnje"; requests: number }) {
  return (
    <ScreenTabs
      label="Maše in nameni"
      current={current}
      tabs={[
        { href: "/teden", label: "Nameni" },
        { href: "/teden/prosnje", label: requests ? `Prošnje (${requests})` : "Prošnje" },
      ]}
    />
  );
}

/** Verouk: "Ta teden" and "Vpisi (n)". */
export function VeroukTabs({ current, enrolments }: { current: "/verouk" | "/verouk/vpisi"; enrolments: number }) {
  return (
    <ScreenTabs
      label="Verouk"
      current={current}
      tabs={[
        { href: "/verouk", label: "Ta teden" },
        { href: "/verouk/vpisi", label: enrolments ? `Vpisi (${enrolments})` : "Vpisi" },
      ]}
    />
  );
}
