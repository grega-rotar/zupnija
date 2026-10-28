"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useState } from "react";
import { routes } from "@/lib/routes";
import { cn } from "@/lib/utils";
import { Icon } from "@/components/ui/Icon";
import s from "./Header.module.css";

export type NavLink = { label: string; href: string };

type Props = {
  parishName: string;
  links: NavLink[];
  /** Further pages, only in the phone menu. */
  more: NavLink[];
  give: NavLink;
};

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * The floating pill. On the homepage it is dark glass over the photograph
 * until the visitor scrolls past most of the first screen, then solid white;
 * every other page has no photograph under it, so it is solid from the start
 * and a spacer keeps the page below it. Phones get a menu panel under the pill.
 */
export function Nav({ parishName, links, more, give }: Props) {
  const pathname = usePathname();
  const home = pathname === routes.home;
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const [lastPath, setLastPath] = useState(pathname);
  const menuId = useId();

  // Close the menu on navigation (state derived from the pathname).
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setOpen(false);
  }

  useEffect(() => {
    if (!home) return;
    const onScroll = () => setScrolled(window.scrollY > window.innerHeight * 0.6);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [home]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const solid = !home || scrolled || open;

  return (
    <>
      <div className={s.bar}>
        <header className={cn(s.nav, solid && s.solid)}>
          <Link href={routes.home} className={s.brand} aria-label={`${parishName}, domov`}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M12 2.5v19M6 8h12" />
            </svg>
            {parishName}
          </Link>
          <nav aria-label="Glavni meni" className={s.desk}>
            <ul className={s.links}>
              {links.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} aria-current={isActive(pathname, l.href) ? "page" : undefined}>
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <div className={s.end}>
            <Link href={give.href} className={s.btn}>
              {give.label}
            </Link>
            <button type="button" className={s.icon} aria-expanded={open} aria-controls={menuId} onClick={() => setOpen((v) => !v)}>
              <Icon name={open ? "close" : "menu"} size={22} />
              <span className="sr-only">{open ? "Zapri meni" : "Odpri meni"}</span>
            </button>
          </div>
        </header>
        <div id={menuId} hidden={!open} className={s.drawer}>
          <nav aria-label="Meni">
            <ul>
              {links.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} aria-current={isActive(pathname, l.href) ? "page" : undefined}>
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
            <ul className={s.minor}>
              {more.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} aria-current={isActive(pathname, l.href) ? "page" : undefined}>
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </div>
      {home ? null : <div className={s.spacer} aria-hidden="true" />}
    </>
  );
}
